'use strict';

// Helper class to rewrite nodes with specific mime type

const Transform = require('stream').Transform;
const libmime = require('libmime');

/**
 * NodeRewriter Transform stream. Updates content for all nodes with specified mime type
 *
 * @constructor
 * @param {String} mimeType Define the Mime-Type to look for
 * @param {Function} rewriteAction Function to run with the node content
 */
class NodeRewriter extends Transform {
    constructor(mimeTypes, rewriteAction) {
        let options = {
            readableObjectMode: true,
            writableObjectMode: true
        };
        super(options);

        this.mimeTypes = [].concat(mimeTypes || 'text/html').map(mimeType => mimeType.toString().toLowerCase().trim());
        this.rewriteAction = rewriteAction;

        this.decoder = false;
        this.encoder = false;
        this.continue = false;
    }

    _transform(data, encoding, callback) {
        this.processIncoming(data, callback);
    }

    _flush(callback) {
        if (this.decoder) {
            this.decoder.end();
        }
        return callback();
    }

    processIncoming(data, callback) {
        if (this.decoder && data.type === 'body') {
            // data to parse
            this.decoder.write(data.value);
        } else if (this.decoder && data.type !== 'body') {
            // stop decoding.
            // we can not process the current data chunk as we need to wait until
            // the parsed data is completely processed, so we store a reference to the
            // continue callback
            this.continue = () => {
                this.continue = false;
                this.decoder = false;
                this.encoder = false;
                this.processIncoming(data, callback);
            };
            return this.decoder.end();
        } else if (data.type === 'node' && this.mimeTypes.includes(data.contentType)) {
            // found matching node, create new handler
            this.createDecoder(data);
        } else {
            // we don't care about this data, just pass it over to the joiner
            this.push(data);
        }
        callback();
    }

    createDecoder(node) {
        let chunks = [];
        let chunklen = 0;

        this.decoder = node.getDecoder();
        if (['base64', 'quoted-printable'].includes(node.encoding)) {
            this.encoder = node.getEncoder();
        } else {
            this.encoder = node.getEncoder('quoted-printable');
        }

        this.encoder.on('data', data => {
            this.push({
                node,
                type: 'body',
                value: data
            });
        });

        this.encoder.on('end', () => {
            if (this.continue) {
                return this.continue();
            }
        });

        this.decoder.on('data', chunk => {
            chunks.push(chunk);
            chunklen += chunk.length;
        });

        this.decoder.on('end', () => {
            let currentBody = Buffer.concat(chunks, chunklen);

            if (node.flowed) {
                console.log('FLOWED!');
                let content = libmime.decodeFlowed(currentBody.toString('binary'), node.delSp);
                console.log(JSON.stringify(content));
                currentBody = Buffer.from(content, 'binary');
            }

            console.log(node._parsedContentType);
            this.rewriteAction(node, currentBody, (err, body) => {
                if (err) {
                    return this.push(err);
                }
                this.push(node);
                // TODO: if body was changed then
                // 1. check if body includes non-ascii symbols and transfer-encoding is not set
                // 2. check if body is format=flow, then unset delsp=yes (maybe not use flowed?)
                this.encoder.end(body || currentBody);
            });
        });
    }
}

module.exports = NodeRewriter;
