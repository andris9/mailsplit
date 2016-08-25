'use strict';

const MessageSplitter = require('./lib/message-splitter');
const MessageJoiner = require('./lib/message-joiner');
const Headers = require('./lib/headers');

module.exports = {
    Splitter: MessageSplitter,
    Joiner: MessageJoiner,
    Headers
};
