'use strict';

const Transform = require('stream').Transform;
const Headers = require('./lib/headers');
const libmime = require('libmime');
const PassThrough = require('stream').PassThrough;

class MimeNode {
    constructor(parentNode) {
        this.type = 'node';

        this._parentNode = parentNode;
        this._parentBoundary = this._parentNode && this._parentNode._boundary;
        this._headersLines = [];
        this._headerlen = 0;

        this._parsedContentType = false;
        this._boundary = false;
        this._multipart = false;

        this.headers = false;
        this.contentType = false;
    }

    _addHeaderLine(line) {
        if (!line) {
            return;
        }
        this._headersLines.push(line);
        this._headerlen += line.length;
    }

    _parseHeaders() {
        this.headers = new Headers(Buffer.concat(this._headersLines, this._headerlen));

        this._parsedContentType = libmime.parseHeaderValue(this.headers.getFirst('Content-Type'));
        this._encoding = this.headers.getFirst('Content-Transfer-Encoding').toLowerCase();

        this.contentType = (this._parsedContentType.value || '').toLowerCase().trim();

        this._multipart = this.contentType.substr(0, this.contentType.indexOf('/')) === 'multipart' && this.contentType.substr(this.contentType.indexOf('/') + 1) || false;
        this._boundary = this._parsedContentType.params.boundary && Buffer.from(this._parsedContentType.params.boundary) || false;
    }
}

class MessageSplitter extends Transform {
    constructor() {
        let options = {
            readableObjectMode: true,
            writableObjectMode: false
        };
        super(options);

        this.state = 'HEAD';
        this.tree = [];
        this.node = new MimeNode(false);
        this.tree.push(this.node);

        this.line = false;
    }

    _transform(chunk, encoding, callback) {
        // process line by line

        // find next line ending
        let c;
        let pos = 0;
        let i = 0;
        let group = {
            type: 'none'
        };
        let groupstart = this.line ? -this.line.length : 0;
        let groupend = 0;

        let iterateData = () => {
            for (let len = chunk.length; i < len; i++) {
                c = chunk[i];
                if (c === 0x0A) {
                    // line end
                    let start = pos;
                    pos = ++i;
                    return this.processLine(chunk.slice(start, i), data => {
                        if (!data) {
                            return setImmediate(iterateData);
                        }

                        if (data.type === group.type) {
                            // shift slice end position forward
                            groupend = i;
                        } else {
                            if (group.type !== 'none' && group.type !== 'node') {
                                // we have a previous data/body chunk to output
                                group.value = chunk.slice(groupstart, groupend);
                                this.push(group);
                            }

                            if (data.type === 'node' || groupstart < 0) {
                                this.push(data);
                                groupstart = i;
                                groupend = i;
                            } else {
                                // start new body/data chunk
                                group = data;
                                groupstart = start;
                                groupend = i;
                            }
                        }

                        return setImmediate(iterateData);
                    });
                }
            }

            if (group.type !== 'none' && group.type !== 'node') {
                // we have a leftover data/body chunk to push out
                group.value = chunk.slice(groupstart, pos);
                this.push(group);
            }

            if (pos < chunk.length) {
                if (this.line) {
                    this.line = Buffer.concat([this.line, chunk.slice(pos)]);
                } else {
                    this.line = chunk.slice(pos);
                }
            }
            callback();
        };

        iterateData();
    }

    _flush(callback) {
        if (this.line) {
            return this.processLine(false, data => {
                if (data) {
                    this.push(data);
                }
                callback();
            });
        }
        callback();
    }

    compareBoundary(line, boundary) {
        // --{boundary}\r\n or --{boundary}--\r\n
        if (line.length !== boundary.length + 4 && line.length !== boundary.length + 6) {
            return false;
        }
        for (let i = 0; i < boundary.length; i++) {
            if (line[i + 2] !== boundary[i]) {
                return false;
            }
        }
        // seems to be a boundary indeed
        // 1: next node, 2: multipart end
        return line.length === boundary.length + 4 ? 1 : 2;
    }

    checkBoundary(line) {
        if (line.length < 4 || line[0] !== 0x2D || line[1] !== 0x2D) {
            // defnitely not a boundary
            return false;
        }

        let boundary;
        //console.log('<%s> <%s>', JSON.stringify(line.toString()), JSON.stringify(this.node._boundary.toString()));
        if (this.node._boundary && (boundary = this.compareBoundary(line, this.node._boundary))) {
            // 1: next child
            // 2: multipart end
            return boundary;
        }

        if (this.node._parentBoundary && (boundary = this.compareBoundary(line, this.node._parentBoundary))) {
            // 3: next sibling
            // 4: parent end
            return boundary + 2;
        }

        return false;
    }

    processLine(line, next) {
        if (this.line && line) {
            line = Buffer.concat([this.line, line]);
            this.line = false;
        } else if (this.line && !line) {
            line = this.line;
            this.line = false;
        }

        switch (this.state) {
            case 'HEAD':
                {
                    this.node._addHeaderLine(line);
                    if ((line.length === 1 && line[0] === 0x0A) || (line.length === 2 && line[0] === 0x0D && line[1] === 0x0A)) {
                        this.state = 'BODY';
                        this.node._parseHeaders();

                        if (this.node._multipart && this.node._boundary) {
                            this.tree.push(this.node);
                        }

                        return setImmediate(() => {
                            next(this.node);
                        });
                    }

                    return setImmediate(next);
                }
            case 'BODY':
                {
                    let boundary = this.checkBoundary(line);
                    if (!boundary) {
                        // not a boundary line
                        return setImmediate(() => {
                            if (this.node._multipart) {
                                next({
                                    node: this.node,
                                    type: 'data',
                                    value: line
                                });
                            } else {
                                next({
                                    node: this.node,
                                    type: 'body',
                                    value: line
                                });
                            }
                        });
                    }

                    // reached boundary. switch context
                    switch (boundary) {
                        case 1:
                            // next child
                            this.node = new MimeNode(this.node);
                            this.state = 'HEAD';
                            break;
                        case 2:
                            // reached end of children, keep current node
                            break;
                        case 3:
                            // next sibling
                            this.node = new MimeNode(this.node._parentNode);
                            this.state = 'HEAD';
                            break;
                        case 4:
                            // move up
                            this.node = this.tree.pop();
                            this.state = 'BODY';
                            break;
                    }

                    return setImmediate(() => next({
                        node: this.node,
                        type: 'data',
                        value: line
                    }));
                }
        }

        setImmediate(() => {
            next({
                line: line.toString()
            });
        });
    }
}

class MessageJoiner extends Transform {
    constructor() {
        let options = {
            readableObjectMode: false,
            writableObjectMode: true
        };
        super(options);
    }

    _transform(obj, encoding, callback) {
        if (obj.type === 'node') {
            this.push(obj.headers.build());
        } else if (obj.value) {
            this.push(obj.value);
        }
        return callback();
    }

    _flush(callback) {
        return callback();
    }
}

class NodeDecoder extends Transform {
    constructor() {
        let options = {
            readableObjectMode: true,
            writableObjectMode: true
        };
        super(options);

        this.decoder = new PassThrough();
        this.decoder.on('readable', () => {
            let chunk;
            while((chunk = this.decoder.read())!==null){
                
            }
        });
    }

    _transform(obj, encoding, callback) {
        return callback();
    }

    _flush(callback) {

        return callback();
    }
}

module.exports.MessageSplitter = MessageSplitter;
module.exports.MessageJoiner = MessageJoiner;

let fs = require('fs');
let splitter = new MessageSplitter();
let joiner = new MessageJoiner();

fs.createReadStream('test/fixtures/source2.eml').pipe(splitter).pipe(joiner).pipe(fs.createWriteStream('out.eml'));
