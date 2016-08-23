'use strict';

const Transform = require('stream').Transform;

class MessageJoiner extends Transform {
    constructor() {
        let options = {
            readableObjectMode: false,
            writableObjectMode: true
        };
        super(options);
    }

    _transform(obj, encoding, callback) {
        if (obj.type === 'node') {
            this.push(obj.getHeaders());
        } else if (obj.value) {
            this.push(obj.value);
        }
        return callback();
    }

    _flush(callback) {
        return callback();
    }
}

module.exports = MessageJoiner;
