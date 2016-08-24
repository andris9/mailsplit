'use strict';

const Transform = require('stream').Transform;
const MimeNode = require('./mime-node');

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

                            if (group.type === 'body' && groupend > groupstart) {
                                // do not include the last line ending for body
                                if (chunk[groupend - 1] === 0x0A) {
                                    groupend--;
                                    if (groupend > groupstart && chunk[groupend - 1] === 0x0D) {
                                        groupend--;
                                    }
                                }
                            }

                            if (group.type !== 'none' && group.type !== 'node') {
                                // we have a previous data/body chunk to output

                                if (groupstart !== groupend) {
                                    group.value = chunk.slice(groupstart, groupend);
                                    this.push(group);
                                }
                            }

                            if (data.type === 'node' || groupstart < 0) {
                                this.push(data);
                                groupstart = i;
                                groupend = i;
                            } else {
                                // start new body/data chunk
                                group = data;
                                groupstart = groupend;
                                groupend = i;
                            }
                        }

                        return setImmediate(iterateData);
                    });
                }
            }

            // skip last linebreak for body
            if (pos >= groupstart + 1 && group.type === 'body') {
                // do not include the last line ending for body
                if (chunk[pos - 1] === 0x0A) {
                    pos--;
                    if (pos > groupstart && chunk[pos - 1] === 0x0D) {
                        pos--;
                    }
                }
            }

            if (group.type !== 'none' && group.type !== 'node' && pos > groupstart) {
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

    compareBoundary(line, startpos, boundary) {
        // --{boundary}\r\n or --{boundary}--\r\n
        if (line.length < boundary.length + 3 + startpos || line.length > boundary.length + 6 + startpos) {
            return false;
        }
        for (let i = 0; i < boundary.length; i++) {
            if (line[i + 2 + startpos] !== boundary[i]) {
                return false;
            }
        }

        let pos = 0;
        for (let i = boundary.length + 2 + startpos; i < line.length; i++) {
            let c = line[i];
            if (pos === 0 && (c === 0x0D || c === 0x0A)) {
                // 1: next node
                return 1;
            }
            if (pos === 0 && c !== 0x2D) {
                // expecting "-"
                return false;
            }
            if (pos === 1 && c !== 0x2D) {
                // expecting "-"
                return false;
            }
            if (pos === 2 && c !== 0x0D && c !== 0x0A) {
                // expecting line terminator, either <CR> or <LF>
                return false;
            }
            if (pos === 3 && c !== 0x0A) {
                // expecting line terminator <LF>
                return false;
            }
            pos++;
        }

        // 2: multipart end
        return 2;
    }

    checkBoundary(line) {
        let startpos = 0;
        if (line.length >= 1 && (line[0] === 0x0D || line[0] === 0x0A)) {
            startpos++;
            if (line.length >= 2 && (line[0] === 0x0D || line[1] === 0x0A)) {
                startpos++;
            }
        }
        if (line.length < 4 || line[startpos] !== 0x2D || line[startpos + 1] !== 0x2D) {
            // defnitely not a boundary
            return false;
        }

        let boundary;
        if (this.node._boundary && (boundary = this.compareBoundary(line, startpos, this.node._boundary))) {
            // 1: next child
            // 2: multipart end
            return boundary;
        }

        if (this.node._parentBoundary && (boundary = this.compareBoundary(line, startpos, this.node._parentBoundary))) {
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

                        let currentNode = this.node;

                        currentNode._parseHeaders();

                        // if the content is attached message then just continue
                        if (currentNode.contentType === 'message/rfc822') {
                            this.state = 'HEAD';
                            this.node = new MimeNode(currentNode);
                            if (currentNode.parentNode) {
                                this.node._parentBoundary = currentNode.parentNode._boundary;
                            }
                        } else {
                            this.state = 'BODY';
                            if (currentNode._multipart && currentNode._boundary) {
                                this.tree.push(currentNode);
                            }
                        }

                        return setImmediate(() => {
                            next(currentNode);
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
                            {
                                // next sibling
                                let parentNode = this.node.parentNode;
                                if (parentNode && parentNode.contentType === 'message/rfc822') {
                                    // special case where immediate parent is an inline message block
                                    // move up another step
                                    parentNode = parentNode.parentNode;
                                }
                                this.node = new MimeNode(parentNode);
                                this.state = 'HEAD';
                                break;
                            }
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
            next(false);
        });
    }
}

module.exports = MessageSplitter;
