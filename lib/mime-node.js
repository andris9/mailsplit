'use strict';

const Headers = require('./headers');
const libmime = require('libmime');

class MimeNode {
    constructor(parentNode) {
        this.type = 'node';
        this.parentNode = parentNode;

        this._parentBoundary = this.parentNode && this.parentNode._boundary;
        this._headersLines = [];
        this._headerlen = 0;

        this._parsedContentType = false;
        this._boundary = false;
        this._multipart = false;

        this.encoding = false;
        this.headers = false;
        this.contentType = false;
    }

    _addHeaderLine(line) {
        if (!line) {
            return;
        }
        this._headersLines.push(line);
        this._headerlen += line.length;
    }

    parseHeaders() {
        this.headers = new Headers(Buffer.concat(this._headersLines, this._headerlen));
        this._parsedContentType = libmime.parseHeaderValue(this.headers.getFirst('Content-Type'));

        this.encoding = this.headers.getFirst('Content-Transfer-Encoding').toLowerCase().trim();
        this.contentType = (this._parsedContentType.value || '').toLowerCase().trim();

        this._multipart = this.contentType.substr(0, this.contentType.indexOf('/')) === 'multipart' && this.contentType.substr(this.contentType.indexOf('/') + 1) || false;
        this._boundary = this._parsedContentType.params.boundary && Buffer.from(this._parsedContentType.params.boundary) || false;
    }

    getHeaders() {
        if (!this.headers) {
            this.parseHeaders();
        }
        return this.headers.build();
    }

    updateContentType(contentType) {
        contentType = (contentType || '').toLowerCase().trim();
        if (!contentType) {
            return;
        }
        this._parsedContentType.value = contentType;
        this.headers.update('Content-Type', libmime.buildHeaderValue(this._parsedContentType));
    }
}

module.exports = MimeNode;
