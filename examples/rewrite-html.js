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
let rewriter = new Rewriter(['text/html', 'text/plain'], (node, html, callback) => {

    // add a header to the current mime node
    node.headers.add('X-Split', 'yes');

    // html is a Buffer
    if (node.charset) {
        html = iconv.decode(html, node.charset);
    } else {
        html = html.toString('binary');
    }

    // enforce utf-8
    node.setCharset('utf-8');

    // append ad link to the HTML code
    let adLink = '<p><a href="http://example.com/">Visit my Awesome homepage!!!!</a>🐭</p>';

    if (/<\/body\b/i.test(html)) {
        // add before <body> close
        html.replace(/<\/body\b/i, match => '\r\n' + adLink + '\r\n' + match);
    } else {
        // append to the body
        html += '\r\n' + adLink;
    }

    // return a Buffer
    setImmediate(() => callback(null, Buffer.from(html)));
});

// pipe all streams together
fs.createReadStream(__dirname + '/message.eml').pipe(splitter).pipe(rewriter).pipe(joiner).pipe(process.stdout);
