'use strict';

// This example script reads a email message from a file as a stream and adds a link
// to all text/html nodes

const Transform = require('stream').Transform;
const Splitter = require('../lib/message-splitter');
const Joiner = require('../lib/message-joiner');
const fs = require('fs');

/**
 * NodeRewriter Transform stream. Updates content for all nodes with specified mime type
 *
 * @constructor
 * @param {String} mimeType Define the Mime-Type to look for
 * @param {Function} rewriteAction Function to run with the node content
 */
class NodeRewriter extends Transform {
    constructor(mimeType, rewriteAction) {
        let options = {
            readableObjectMode: true,
            writableObjectMode: true
        };
        super(options);

        this.mimeType = (mimeType || '').toString().toLowerCase().trim();
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
        } else if (data.type === 'node' && data.contentType === this.mimeType) {
            // new HTML node, create new handler
            this.createDecoder(data);
            this.push(data);
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
        this.encoder = node.getEncoder();

        this.encoder.on('data', data => {
            this.push(data);
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
            this.rewriteAction(Buffer.concat(chunks, chunklen), (err, data) => {
                if (err) {
                    return this.push(err);
                }
                this.encoder.end(data);
            });
        });
    }
}

let splitter = new Splitter();
let joiner = new Joiner();

// create a Rewriter for text/html
let rewriter = new NodeRewriter('text/html', (html, callback) => {
    // html is a Buffer
    html = html.toString('binary');

    // append ad link to the HTML code
    let adLink = '<p><a href="http://example.com/">Visit my Awesome homepage!!!!</a></p>';

    if (/<\/body\b/i.test(html)) {
        // add before <body> close
        html.replace(/<\/body\b/i, match => '\r\n' + adLink + '\r\n' + match);
    } else {
        // append to the body
        html += '\r\n' + adLink;
    }
    // return a Buffer
    setImmediate(() => callback(null, Buffer.from(html, 'binary')));
});

// pipe all streams together
fs.createReadStream(__dirname + '/message.eml').pipe(splitter).pipe(rewriter).pipe(joiner).pipe(process.stdout);
