'use strict';

let MimeNode = require('../lib/mime-node');

module.exports['Add and parse headers'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Subject: test\r\n'));
    mimeNode.addHeaderChunk(Buffer.from(' jne\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('X-Mailer: 12345\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('\r\n'));

    mimeNode.parseHeaders();

    test.equal(mimeNode.getHeaders().toString(), 'Subject: test\r\n jne\r\nX-Mailer: 12345\r\n\r\n');

    test.done();
};

module.exports['Update Content-Type'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Subject: test\r\n'));
    mimeNode.addHeaderChunk(Buffer.from(' jne\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('Content-Type: text/plain;\r\n'));
    mimeNode.addHeaderChunk(Buffer.from(' boundary="abc"\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('X-Mailer: 12345\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('\r\n'));

    mimeNode.parseHeaders();

    mimeNode.setContentType('image/png');

    test.equal(mimeNode.getHeaders().toString(), 'Subject: test\r\n jne\r\nContent-Type: image/png; boundary=abc\r\nX-Mailer: 12345\r\n\r\n');

    test.done();
};

module.exports['Get filename from Content-Type'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from(
            'Content-Type: application/octet-stream; name="=?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?="\r\nContent-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
        )
    );

    mimeNode.parseHeaders();
    test.equal(mimeNode.disposition, false);
    test.equal(mimeNode.filename, 'ÕÄÖÜ');
    test.done();
};

module.exports['Get split filename from Content-Type'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from(
            'Content-Type: application/octet-stream;\r\n' +
                '    name*0*=UTF-8\'\'%C3%95%C3%84;\r\n' +
                '    name*1*=%C3%96%C3%9C\r\n' +
                'Content-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
        )
    );

    mimeNode.parseHeaders();
    test.equal(mimeNode.filename, 'ÕÄÖÜ');
    test.done();
};

module.exports['Get filename from Content-Disposition'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from('Content-Disposition: inline; filename="=?UTF-8?Q?=C3=95=C3=84=C3=96=C3=9C?="\r\nContent-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n')
    );

    mimeNode.parseHeaders();
    test.equal(mimeNode.disposition, 'inline');
    test.equal(mimeNode.filename, 'ÕÄÖÜ');
    test.done();
};

module.exports['Get split filename from Content-Disposition'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from(
            'Content-Disposition:attachment;\r\n' +
                '    filename*0*=UTF-8\'\'%C3%95%C3%84;\r\n' +
                '    filename*1*=%C3%96%C3%9C\r\n' +
                'Content-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
        )
    );

    mimeNode.parseHeaders();
    test.equal(mimeNode.disposition, 'attachment');
    test.equal(mimeNode.filename, 'ÕÄÖÜ');
    test.done();
};

module.exports['Set filename'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from(
            'Content-Disposition:attachment;\r\n' +
                '    filename*0*=UTF-8\'\'%C3%95%C3%84;\r\n' +
                '    filename*1*=%C3%96%C3%9C\r\n' +
                'Content-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
        )
    );

    mimeNode.parseHeaders();

    mimeNode.setFilename('jõgeva.txt');

    test.equal(
        mimeNode.getHeaders().toString(),
        'Content-Disposition: attachment; filename*0*=utf-8\'\'j%C3%B5geva.txt\r\nContent-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
    );

    test.done();
};

module.exports['Delete filename'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(
        Buffer.from(
            'Content-Disposition:attachment;\r\n' +
                '    filename*0*=UTF-8\'\'%C3%95%C3%84;\r\n' +
                '    filename*1*=%C3%96%C3%9C\r\n' +
                'Content-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n'
        )
    );

    mimeNode.parseHeaders();

    mimeNode.setFilename(false);
    test.equal(mimeNode.getHeaders().toString(), 'Content-Disposition: attachment\r\nContent-Transfer-Encoding: QUOTED-PRINTABLE\r\n\r\n');
    test.done();
};

module.exports['Update existing filename'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Subject: test\r\n'));
    mimeNode.addHeaderChunk(Buffer.from(' jne\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('Content-Type: text/plain;\r\n'));
    mimeNode.addHeaderChunk(Buffer.from(' boundary="abc"\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('X-Mailer: 12345\r\n'));
    mimeNode.addHeaderChunk(Buffer.from('\r\n'));

    mimeNode.parseHeaders();

    mimeNode.setFilename('jõgeva.txt');
    test.equal(
        mimeNode.getHeaders().toString(),
        'Content-Disposition: attachment; filename*0*=utf-8\'\'j%C3%B5geva.txt\r\nSubject: test\r\n jne\r\nContent-Type: text/plain;\r\n boundary="abc"\r\nX-Mailer: 12345\r\n\r\n'
    );
    test.done();
};

module.exports['Set character set'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Subject: test\r\n\r\n'));

    mimeNode.parseHeaders();

    mimeNode.setCharset('utf-8');
    test.equal(mimeNode.getHeaders().toString(), 'Content-Type: text/plain; charset=utf-8\r\nSubject: test\r\n\r\n');
    test.done();
};

module.exports['Update character set'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Content-Type: text/plain; charset=utf-8\r\nSubject: test\r\n\r\n'));

    mimeNode.parseHeaders();

    mimeNode.setCharset('ISO-8859-1');
    test.equal(mimeNode.getHeaders().toString(), 'Content-Type: text/plain; charset=iso-8859-1\r\nSubject: test\r\n\r\n');
    test.done();
};

module.exports['Remove character set'] = test => {
    let mimeNode = new MimeNode();

    mimeNode.addHeaderChunk(Buffer.from('Content-Type: text/plain; charset=utf-8\r\nSubject: test\r\n\r\n'));

    mimeNode.parseHeaders();

    mimeNode.setCharset('ascii');
    test.equal(mimeNode.getHeaders().toString(), 'Content-Type: text/plain\r\nSubject: test\r\n\r\n');
    test.done();
};
