'use strict';

const Headers = require('./headers');
const libmime = require('libmime');
const libqp = require('libqp');
const libbase64 = require('libbase64');
const PassThrough = require('stream').PassThrough;

class MimeNode {
    constructor(parentNode) {
        this.type = 'node';
        this.root = !parentNode;
        this.parentNode = parentNode;

        this._parentBoundary = this.parentNode && this.parentNode._boundary;
        this._headersLines = [];
        this._headerlen = 0;

        this._parsedContentType = false;
        this._boundary = false;

        this.multipart = false;
        this.encoding = false;
        this.headers = false;
        this.contentType = false;
        this.flowed = false;
        this.delSp = false;
    }

    addHeaderChunk(line) {
        if (!line) {
            return;
        }
        this._headersLines.push(line);
        this._headerlen += line.length;
    }

    parseHeaders() {
        if (this.headers) {
            return;
        }
        this.headers = new Headers(Buffer.concat(this._headersLines, this._headerlen));
        this._parsedContentType = libmime.parseHeaderValue(this.headers.getFirst('Content-Type'));
        this._parsedContentDisposition = libmime.parseHeaderValue(this.headers.getFirst('Content-Disposition'));

        this.encoding = this.headers.getFirst('Content-Transfer-Encoding').replace(/\(.*\)/g, '').toLowerCase().trim();
        this.contentType = (this._parsedContentType.value || '').toLowerCase().trim() || false;
        this.charset = this._parsedContentType.params.charset || false;
        this.disposition = (this._parsedContentDisposition.value || '').toLowerCase().trim() || false;
        this.filename = this._parsedContentDisposition.params.filename || this._parsedContentType.params.name || false;

        if (this._parsedContentType.params.format && this._parsedContentType.params.format.toLowerCase().trim() === 'flowed') {
            this.flowed = true;
            if (this._parsedContentType.params.delsp && this._parsedContentType.params.delsp.toLowerCase().trim() === 'yes') {
                this.delSp = true;
            }
        }

        if (this.filename) {
            try {
                this.filename = libmime.decodeWords(this.filename);
            } catch (E) {
                // failed to parse filename, keep as is (most probably an unknown charset is used)
            }
        }

        this.multipart = this.contentType && this.contentType.substr(0, this.contentType.indexOf('/')) === 'multipart' && this.contentType.substr(this.contentType.indexOf('/') + 1) || false;
        this._boundary = this._parsedContentType.params.boundary && Buffer.from(this._parsedContentType.params.boundary) || false;
    }

    getHeaders() {
        if (!this.headers) {
            this.parseHeaders();
        }
        return this.headers.build();
    }

    setContentType(contentType) {
        if (!this.headers) {
            this.parseHeaders();
        }

        contentType = (contentType || '').toLowerCase().trim();
        if (contentType) {
            this._parsedContentType.value = contentType;
        }

        if (!this.flowed && this._parsedContentType.params.format) {
            delete this._parsedContentType.params.format;
        }

        if (!this.delSp && this._parsedContentType.params.delsp) {
            delete this._parsedContentType.params.delsp;
        }

        this.headers.update('Content-Type', libmime.buildHeaderValue(this._parsedContentType));
    }

    setCharset(charset) {
        if (!this.headers) {
            this.parseHeaders();
        }

        charset = (charset || '').toLowerCase().trim();

        if (charset === 'ascii') {
            charset = '';
        }

        if (!charset) {
            if (!this._parsedContentType.value) {
                // nothing to set or update
                return;
            }
            delete this._parsedContentType.params.charset;
        } else {
            this._parsedContentType.params.charset = charset;
        }

        if (!this._parsedContentType.value) {
            this._parsedContentType.value = 'text/plain';
        }

        this.headers.update('Content-Type', libmime.buildHeaderValue(this._parsedContentType));
    }

    setFilename(filename) {
        if (!this.headers) {
            this.parseHeaders();
        }

        this.filename = (filename || '').toLowerCase().trim();

        if (this._parsedContentType.params.name) {
            delete this._parsedContentType.params.name;
            this.headers.update('Content-Type', libmime.buildHeaderValue(this._parsedContentType));
        }

        if (!this.filename) {
            if (!this._parsedContentDisposition.value) {
                // nothing to set or update
                return;
            }
            delete this._parsedContentDisposition.params.filename;
        } else {
            this._parsedContentDisposition.params.filename = this.filename;
        }

        if (!this._parsedContentDisposition.value) {
            this._parsedContentDisposition.value = 'attachment';
        }

        this.headers.update('Content-Disposition', libmime.buildHeaderValue(this._parsedContentDisposition));
    }

    getDecoder() {
        if (!this.headers) {
            this.parseHeaders();
        }

        switch (this.encoding) {
            case 'base64':
                return new libbase64.Decoder();
            case 'quoted-printable':
                return new libqp.Decoder();
            default:
                return new PassThrough();
        }
    }

    getEncoder(encoding) {
        if (!this.headers) {
            this.parseHeaders();
        }

        encoding = (encoding || '').toString().toLowerCase().trim();

        if (encoding && encoding !== this.encoding) {
            this.headers.update('Content-Transfer-Encoding', encoding);
        } else {
            encoding = this.encoding;
        }

        switch (encoding) {
            case 'base64':
                return new libbase64.Encoder();
            case 'quoted-printable':
                return new libqp.Encoder();
            default:
                return new PassThrough();
        }
    }
}

module.exports = MimeNode;
