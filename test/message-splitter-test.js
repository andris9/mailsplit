'use strict';

const fs = require('fs');
const MessageSplitter = require('../lib/message-splitter');
const MessageJoiner = require('../lib/message-joiner');

module.exports['Split simple message'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Subject: test\nMime-Version: 1.0\n\n');
        },
        data => {
            test.equal(data.type, 'body');
            test.equal(data.value.toString(), 'Hello world!');
        }
    ];

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    test.ok(true);
    splitter.end('Subject: test\nMime-Version: 1.0\n\nHello world!');

};

module.exports['Split multipart message'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Content-type: multipart/mixed; boundary=ABC\r\nX-Test: =?UTF-8?Q?=C3=95=C3=84?= =?UTF-8?Q?=C3=96=C3=9C?=\r\nSubject: ABCDEF\r\n\r\n');
        },
        data => {
            test.equal(data.type, 'data');
            test.equal(data.value.toString(), '--ABC\n');
        },
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Content-Type: application/octet-stream\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\'test.pdf\'\r\n\r\n');
        },
        data => {
            test.equal(data.type, 'body');
            test.equal(data.value.toString(), 'AAECAwQFBg==');
        },
        data => {
            test.equal(data.type, 'data');
            test.equal(data.value.toString(), '\r\n--ABC--');
        }
    ];

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end(Buffer.from('Content-type: multipart/mixed; boundary=ABC\r\n' +
        'X-Test: =?UTF-8?Q?=C3=95=C3=84?= =?UTF-8?Q?=C3=96=C3=9C?=\r\n' +
        'Subject: ABCDEF\r\n' +
        '\r\n' +
        '--ABC\n' +
        'Content-Type: application/octet-stream\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        'Content-Disposition: attachment; filename=\'test.pdf\'\r\n' +
        '\r\n' +
        'AAECAwQFBg==\r\n' +
        '--ABC--'));
};


module.exports['Split and join mimetorture message'] = test => {

    let data = fs.readFileSync(__dirname + '/fixtures/mimetorture.eml');

    let splitter = new MessageSplitter();
    let joiner = new MessageJoiner();

    let chunks = [];

    joiner.on('data', chunk => {
        chunks.push(chunk);
    });

    joiner.on('end', () => {
        test.equal(data.toString('binary'), Buffer.concat(chunks).toString('binary'));
        test.done();
    });


    fs.createReadStream(__dirname + '/fixtures/mimetorture.eml').pipe(splitter).pipe(joiner);

};
