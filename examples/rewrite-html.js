'use strict';

// This example script reads a email message from a file as a stream and updates
// text/html content where a link is added to the message

let Splitter = require('../lib/message-splitter');
let Joiner = require('../lib/message-joiner');
let libqp = require('libqp');
let libbase64 = require('libbase64');

let fs = require('fs');

let splitter = new Splitter();
let joiner = new Joiner();

let chunks = false;
let chunklen = 0;
let htmlNode = false;

splitter.on('data', data => {
    if (htmlNode && data.type !== 'body') {
        // finish existing
        let body = Buffer.concat(chunks, chunklen);
        switch (htmlNode.encoding) {
            case 'base64':
                body = libbase64.decode(body.toString());
                break;
            case 'quoted-printable':
                body = libqp.decode(body.toString());
                break;
        }
        body = body.toString('binary');

        // append ad link to the HTML code
        let adLink = '<p><a href="">Visit my Awesome homepage!!!!</a></p>';
        if (/<\/body\b/i.test(body)) {
            // add before <body> close
            body.replace(/<\/body\b/i, match => '\r\n' + adLink + '\r\n' + match);
        } else {
            // append to the body
            body += '\r\n' + adLink;
        }

        // restore encoded version
        body = Buffer.from(body, 'binary');
        switch (htmlNode.encoding) {
            case 'base64':
                body = Buffer.from(libbase64.wrap(libbase64.encode(body)));
                break;
            case 'quoted-printable':
                body = Buffer.from(libqp.wrap(libqp.encode(body)));
                break;
        }

        joiner.write({
            type: 'body',
            value: body
        });

        htmlNode = false;
    }

    if (data.type === 'node' && data.contentType === 'text/html') {
        // new HTML node, reset handler

        htmlNode = data;
        chunks = [];
        chunklen = 0;

    } else if (htmlNode && data.type === 'body') {
        // store data for decoding
        chunks.push(data.value);
        chunklen += data.value.length;
    } else {
        // we don't care about this data, just pass it over to the joiner
        joiner.write(data);
    }
});

splitter.on('end', () => {
    joiner.end();
});

joiner.pipe(process.stdout);

// pipe message from file to splitter
fs.createReadStream(__dirname + '/message.eml').pipe(splitter);
