'use strict';

// This example script reads a email message from a file as a stream and adds a link
// to all text/html nodes

const Rewriter = require('../lib/node-rewriter');
const Splitter = require('../lib/message-splitter');
const Joiner = require('../lib/message-joiner');
const iconv = require('iconv-lite');
const fs = require('fs');

let splitter = new Splitter();
let joiner = new Joiner();

// create a Rewriter for text/html
let rewriter = new Rewriter(node => ['text/html', 'text/plain', 'image/gif'].includes(node.contentType));

rewriter.on('node', data => {
    // add a header to the current mime node
    data.node.headers.add('X-Split', 'yes');

    if (data.node.contentType === 'image/gif') {
        data.decoder.pipe(fs.createWriteStream('test.gif'));
        data.decoder.pipe(data.encoder);
        return;
    }

    let chunks = [];
    let chunklen = 0;
    data.decoder.on('data', chunk => {
        chunks.push(chunk);
        chunklen += chunk.length;
    });

    data.decoder.on('end', () => {
        let html = Buffer.concat(chunks, chunklen);

        // html is a Buffer
        if (data.node.charset) {
            html = iconv.decode(html, data.node.charset);
        } else {
            html = html.toString('binary');
        }

        // enforce utf-8
        data.node.setCharset('utf-8');

        if (data.node.contentType === 'text/html') {
            // append ad link to the HTML code
            let adLink = '<p><a href="http://example.com/">Visit my Awesome homepage!!!!</a>🐭</p>';

            if (/<\/body\b/i.test(html)) {
                // add before <body> close
                html.replace(/<\/body\b/i, match => '\r\n' + adLink + '\r\n' + match);
            } else {
                // append to the body
                html += '\r\n' + adLink;
            }
        } else {
            // append ad link to the HTML code
            let adLink = 'Visit my Awesome homepage!!!! <http://example.com/> 🐭';
            // append to the body
            html += '\r\n' + adLink;
        }
        // return a Buffer
        data.encoder.end(Buffer.from(html));
    });
});

// pipe all streams together
fs.createReadStream(__dirname + '/message.eml')
    .pipe(splitter)
    .pipe(rewriter)
    .pipe(joiner)
    .pipe(process.stdout);
