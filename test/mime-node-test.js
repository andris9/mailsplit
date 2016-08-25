'use strict';

let MimeNode = require('../lib/mime-node');

module.exports['Add and parse headers'] = test => {
    let mimeNode = new MimeNode();

    mimeNode._addHeaderLine(Buffer.from('Subject: test\r\n'));
    mimeNode._addHeaderLine(Buffer.from(' jne\r\n'));
    mimeNode._addHeaderLine(Buffer.from('X-Mailer: 12345\r\n'));
    mimeNode._addHeaderLine(Buffer.from('\r\n'));

    mimeNode.parseHeaders();

    test.equal(mimeNode.getHeaders().toString(), 'Subject: test\r\n jne\r\nX-Mailer: 12345\r\n\r\n');

    test.done();
};

module.exports['Update Content-Type'] = test => {
    let mimeNode = new MimeNode();

    mimeNode._addHeaderLine(Buffer.from('Subject: test\r\n'));
    mimeNode._addHeaderLine(Buffer.from(' jne\r\n'));
    mimeNode._addHeaderLine(Buffer.from('Content-Type: text/plain;\r\n'));
    mimeNode._addHeaderLine(Buffer.from(' boundary="abc"\r\n'));
    mimeNode._addHeaderLine(Buffer.from('X-Mailer: 12345\r\n'));
    mimeNode._addHeaderLine(Buffer.from('\r\n'));

    mimeNode.parseHeaders();

    mimeNode.updateContentType('image/png');

    test.equal(mimeNode.getHeaders().toString(), 'Subject: test\r\n jne\r\nContent-Type: image/png; boundary=abc\r\nX-Mailer: 12345\r\n\r\n');

    test.done();
};
