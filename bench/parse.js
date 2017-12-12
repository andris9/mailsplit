'use strict';

const mailsplit = require('../index.js');
const Splitter = mailsplit.Splitter;
const Joiner = mailsplit.Joiner;
const randomMessage = require('random-message');
const messages = Number(process.env.MESSAGES) || 10000;

const messagesRoot = '/Users/andris/Projects/nodemailer/Gmail/Messages';
let processed = 0;
let startTime = Date.now();
let bytes = 0;

let processNext = () => {
    if (++processed >= messages) {
        let time = (Date.now() - startTime) / 1000;
        let avg = Math.round(processed / time);
        console.log(
            'Done. %s messages [%s MB] processed in %s s. with average of %s messages/sec [%s MB/s]',
            processed,
            Math.round(bytes / (1024 * 1024)),
            time,
            avg,
            Math.round(bytes / (1024 * 1024) / time)
        ); // eslint-disable-line no-console
        return;
    }

    let splitter = new Splitter();
    let joiner = new Joiner();

    joiner.on('readable', () => {
        let chunk;
        while ((chunk = joiner.read()) !== null) {
            bytes += chunk.length;
        }
    });

    joiner.on('end', () => {
        splitter = false;
        joiner = false;
        setImmediate(processNext);
    });

    randomMessage
        .get(messagesRoot, (processed * 0x10000).toString(16))
        .pipe(splitter)
        .pipe(joiner);
};

console.log('Streaming %s random messages through Splitter and Joiner', messages); // eslint-disable-line no-console
processNext();
