'use strict';

const MessageSplitter = require('./lib/message-splitter');
const MessageJoiner = require('./lib/message-joiner');

module.exports = {
    Splitter: MessageSplitter,
    Joiner: MessageJoiner
};
