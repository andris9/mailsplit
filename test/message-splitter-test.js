'use strict';

const fs = require('fs');
const crypto = require('crypto');
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
    test.expect(6);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('Subject: test\nMime-Version: 1.0\n\nHello world!');

};

module.exports['Split simple message with line ending'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Subject: test\nMime-Version: 1.0\n\n');
        },
        data => {
            test.equal(data.type, 'body');
            test.equal(data.value.toString(), 'Hello world!\r\n');
        }
    ];
    test.expect(6);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('Subject: test\nMime-Version: 1.0\n\nHello world!\r\n');

};

module.exports['Split message with header only 1'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Subject: test\nMime-Version: 1.0');
        }
    ];
    test.expect(3);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('Subject: test\nMime-Version: 1.0');
};

module.exports['Split message with header only 2'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Subject: test\nMime-Version: 1.0\n');
        }
    ];
    test.expect(3);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('Subject: test\nMime-Version: 1.0\n');
};

module.exports['Split message with empty body'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Subject: test\nMime-Version: 1.0\n\n');
        }
    ];
    test.expect(3);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('Subject: test\nMime-Version: 1.0\n\n');
};

module.exports['Split message with no header'] = test => {

    let splitter = new MessageSplitter();

    let tests = [
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), '\n');
        },
        data => {
            test.equal(data.type, 'body');
            test.equal(data.value.toString(), 'Hello world!');
        }
    ];
    test.expect(6);

    splitter.on('data', data => {
        let nextTest = tests.shift();
        test.ok(nextTest);
        nextTest(data);
    });

    splitter.on('end', () => {
        test.done();
    });

    splitter.end('\nHello world!');
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
    test.expect(15);

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

module.exports['Split multipart message without terminating boundary'] = test => {

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
        }
    ];
    test.expect(12);

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
        'AAECAwQFBg=='));
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

module.exports['Fetch attachment from form-data'] = test => {

    let splitter = new MessageSplitter();

    let attachment = false;
    let hash = crypto.createHash('md5');
    let msghash = crypto.createHash('md5');

    splitter.on('data', data => {
        msghash.update(data.value || data.getHeaders());
        if (data.type === 'body' && attachment) {
            hash.update(data.value);
        } else {
            attachment = false;
            if (data.type === 'node' && data.filename) {
                attachment = true;
            }
        }
    });

    splitter.on('end', () => {
        // check file hash
        test.equal(msghash.digest('hex'), 'b6f36ec4e3985a93aee9047ea5c5e835');

        // check attachment hash
        test.equal(hash.digest('hex'), '6c7388d43ad5961b5c042bfbeb25de99');
        test.done();
    });

    fs.createReadStream(__dirname + '/fixtures/form-data.eml').pipe(splitter);
};

module.exports['Split multipart message with embedded message/rfc88'] = test => {

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
            test.equal(data.getHeaders().toString(), 'Content-Type: message/rfc822\r\n\r\n');
        },
        data => {
            test.equal(data.type, 'node');
            test.equal(data.getHeaders().toString(), 'Content-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\n\r\n');
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
    test.expect(18);

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
        'Content-Type: message/rfc822\r\n' +
        '\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        'AAECAwQFBg==\r\n' +
        '--ABC--'));
};


module.exports['Split multipart message and ignore embedded message/rfc88'] = test => {

    let splitter = new MessageSplitter({ignoreEmbedded: true});

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
            test.equal(data.getHeaders().toString(), 'Content-Type: message/rfc822\r\n\r\n');
        },
        data => {
            test.equal(data.type, 'body');
            test.equal(data.value.toString(), 'Content-Type: text/plain\r\nContent-Transfer-Encoding: base64\r\n\r\nAAECAwQFBg==');
        },
        data => {
            test.equal(data.type, 'data');
            test.equal(data.value.toString(), '\r\n--ABC--');
        }
    ];
    test.expect(15);

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
        'Content-Type: message/rfc822\r\n' +
        '\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        'AAECAwQFBg==\r\n' +
        '--ABC--'));
};
