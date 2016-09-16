'use strict';

const Rewriter = require('../lib/node-rewriter');
const Splitter = require('../lib/message-splitter');
const Joiner = require('../lib/message-joiner');
const fs = require('fs');
const crypto = require('crypto');
const PassThrough = require('stream').PassThrough;

module.exports['Recreate message and extract image'] = test => {
    let splitter = new Splitter();
    let joiner = new Joiner();
    let msgHash = crypto.createHash('md5');
    let imgHash = crypto.createHash('md5');

    // create a Rewriter for text/html
    let rewriter = new Rewriter(node => node.contentType === 'image/jpeg');
    rewriter.on('node', data => {
        data.decoder.on('data', chunk => {
            imgHash.update(chunk);
        });

        data.decoder.pipe(data.encoder);
    });


    let output = fs.createReadStream(__dirname + '/fixtures/large_image.eml').pipe(splitter).pipe(rewriter).pipe(joiner);
    output.on('data', chunk => {
        // use \n newlines
        //chunk = Buffer.from(chunk.toString('binary').replace(/\r/g, ''), 'binary');
        msgHash.update(chunk);
    });
    output.on('end', () => {
        test.equal(msgHash.digest('hex'), '3a5fa4280a54ebfc3ee956fb202a04ea');
        test.equal(imgHash.digest('hex'), '393b91601d78359c99b5b667c2d5dda8');

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

    test.expect(1);
};

module.exports['Recreate message with large image very slowly'] = test => {
    let splitter = new Splitter();
    let joiner = new Joiner();
    let msgHash = crypto.createHash('md5');

    // create a Rewriter for text/html
    let rewriter = new Rewriter(node => node.contentType === 'image/jpeg');
    rewriter.on('node', data => {
        let inputDone = false;
        let reading = false;
        let read = () => {
            setTimeout(() => {
                let chunk = data.decoder.read();
                if (chunk === null) {
                    reading = false;
                    if (inputDone) {
                        data.encoder.end();
                    }
                    return;
                }
                setTimeout(() => {
                    if (!data.encoder.write(chunk)) {
                        data.encoder.once('drain', read);
                    } else {
                        read();
                    }
                }, 100);

            }, 100);
        };

        data.decoder.on('readable', () => {
            if (!reading) {
                reading = true;
                read();
            }
        });

        data.decoder.on('end', () => {
            inputDone = true;
            if (!reading) {
                data.encoder.end();
            }
        });
    });

    let output = fs.createReadStream(__dirname + '/fixtures/large_image.eml').pipe(splitter).pipe(rewriter).pipe(joiner);
    output.on('data', chunk => {
        // normalize to use \n newlines
        // chunk = Buffer.from(chunk.toString('binary').replace(/\r/g, ''), 'binary');
        msgHash.update(chunk);
    });
    output.on('end', () => {
        msgHash = msgHash.digest('hex');

        test.equal(msgHash, '3a5fa4280a54ebfc3ee956fb202a04ea');

        test.done();
    });

    test.expect(1);
};

module.exports['Recreate message with large image one byte at a time'] = test => {
    let splitter = new Splitter();
    let joiner = new Joiner();
    let msgHash = crypto.createHash('md5');

    // create a Rewriter for text/html
    let rewriter = new Rewriter(node => node.contentType === 'image/gif');
    rewriter.on('node', data => {
        let inputDone = false;
        let reading = false;
        let read = () => {
            setTimeout(() => {
                let chunk = data.decoder.read(50);
                if (chunk === null) {
                    reading = false;
                    if (inputDone) {
                        data.encoder.end();
                    }
                    return;
                }

                let bytePos = 0;
                let writeNextByte = () => {
                    if (bytePos >= chunk.length) {
                        return read();
                    }
                    let byte = chunk.slice(bytePos++, bytePos);
                    data.encoder.write(byte);
                    setImmediate(writeNextByte);
                };

                writeNextByte();
            }, 100);
        };

        data.decoder.on('readable', () => {
            if (!reading) {
                reading = true;
                read();
            }
        });

        data.decoder.on('end', () => {
            inputDone = true;
            if (!reading) {
                data.encoder.end();
            }
        });
    });

    let fstream = fs.createReadStream(__dirname + '/fixtures/message.eml');
    let input = new PassThrough();

    let inputDone = false;
    let reading = false;
    let read = () => {
        setTimeout(() => {
            let chunk = fstream.read(50);
            if (chunk === null) {
                reading = false;
                if (inputDone) {
                    input.end();
                }
                return;
            }

            let bytePos = 0;
            let writeNextByte = () => {
                if (bytePos >= chunk.length) {
                    return read();
                }
                let byte = chunk.slice(bytePos++, bytePos);
                input.write(byte);
                setImmediate(writeNextByte);
            };

            writeNextByte();

        }, 100);
    };

    fstream.on('readable', () => {
        if (!reading) {
            reading = true;
            read();
        }
    });

    fstream.on('end', () => {
        inputDone = true;
        if (!reading) {
            input.end();
        }
    });

    let output = input.pipe(splitter).pipe(rewriter).pipe(joiner);
    output.on('data', chunk => {
        // normalize to use \n newlines
        chunk = Buffer.from(chunk.toString('binary').replace(/\r/g, ''), 'binary');
        msgHash.update(chunk);
    });
    output.on('end', () => {
        msgHash = msgHash.digest('hex');

        test.equal(msgHash, 'db6223cc3a59b840558b6f1817c9953d');

        test.done();
    });

    test.expect(1);
};
