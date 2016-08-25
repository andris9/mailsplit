'use strict';

const MessageJoiner = require('../lib/message-joiner');

module.exports['Join split message'] = test => {
    let joiner = new MessageJoiner();
    let s = '';

    joiner.on('data', data => {
        s += data.toString();
    });

    joiner.on('end', () => {
        test.equal(s, 'Subject: test\r\nMIME-Version: 1.0\r\n\r\nHello world!');
        test.done();
    });

    joiner.write({
        type: 'data',
        value: 'Subject: test\r\n'
    });

    joiner.write({
        type: 'data',
        value: 'MIME-Version: 1.0\r\n\r\n'
    });

    joiner.end({
        type: 'body',
        value: 'Hello world!'
    });
};
