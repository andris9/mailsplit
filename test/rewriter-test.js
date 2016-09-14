'use strict';

const Rewriter = require('../lib/node-rewriter');
const Splitter = require('../lib/message-splitter');
const Joiner = require('../lib/message-joiner');
const fs = require('fs');
const crypto = require('crypto');

module.exports['Recreate message and extract image'] = test => {
    let splitter = new Splitter();
    let joiner = new Joiner();
    let msgHash = crypto.createHash('md5');
    let imgHash = crypto.createHash('md5');

    // create a Rewriter for text/html
    let rewriter = new Rewriter(node => node.contentType === 'image/gif');
    rewriter.on('node', data => {
        data.decoder.on('data', chunk => {
            imgHash.update(chunk);
        });

        data.decoder.pipe(data.encoder);
    });

    let output = fs.createReadStream(__dirname + '/fixtures/message.eml').pipe(splitter).pipe(rewriter).pipe(joiner);
    output.on('data', chunk => {
        // use \n newlines
        chunk = Buffer.from(chunk.toString('binary').replace(/\r/g, ''), 'binary');
        msgHash.update(chunk);
    });
    output.on('end', () => {
        test.equal(msgHash.digest('hex'), 'db6223cc3a59b840558b6f1817c9953d');
        test.equal(imgHash.digest('hex'), '2822cbcf68de083b96ac3921d0e308a2');

        test.done();
    });
    test.expect(2);
};

module.exports['Recreate message with updated format=flow text node'] = test => {
    let splitter = new Splitter();
    let joiner = new Joiner();
    let msgHash = crypto.createHash('md5');

    // create a Rewriter for text/html
    let rewriter = new Rewriter(node => node.contentType === 'text/plain' && node.flowed);
    rewriter.on('node', data => {
        let chunks = [];
        data.decoder.on('data', chunk => {
            chunks.push(chunk);
        });
        data.decoder.on('end', () => {
            let str = Buffer.concat(chunks).toString('binary');
            str = '[' + str + ']';
            data.encoder.end(Buffer.from(str, 'binary'));
        });
    });

    let fss = fs.createWriteStream('/Users/andris/Desktop/out2.eml');
    let output = fs.createReadStream(__dirname + '/fixtures/message.eml').pipe(splitter).pipe(rewriter).pipe(joiner);
    output.on('data', chunk => {
        // normalize to use \n newlines
        chunk = Buffer.from(chunk.toString('binary').replace(/\r/g, ''), 'binary');
        msgHash.update(chunk);
    });
    output.on('end', () => {
        msgHash = msgHash.digest('hex');

        test.equal(msgHash, '09abdfab39ec308769e853207202a139');

        test.done();
    });
    output.pipe(fss);

    test.expect(1);
};
