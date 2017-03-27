"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const stream = require("stream");
const events = require("events");
const Serialize_1 = require("./Serialize");
/*
    data format: headerLength->mode->titleLength->title->?bodyLength->body
    body format: count->divide[]->item(datatype->data)
*/
class PostStream extends events.EventEmitter {
    constructor(readable, writable) {
        super();
        this._endFlag = Buffer.from('\r\n«end»');
        this._remainBodyLength = 0;
        this._new = true; //is new data
        this._mode = 0; //0: fixed length，1：unfixed length(use _endFlag to finding end)
        this._queue = Promise.resolve(); // sending queue
        if (writable != null) {
            if (writable.__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');
            if (writable instanceof stream.Writable) {
                this._writable = writable;
            }
            else {
                throw new Error('second argument is not a writable stream');
            }
        }
        if (readable != null) {
            if (readable.__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');
            if (readable instanceof stream.Readable) {
                this._readable = readable;
            }
            else if (readable instanceof stream.Duplex) {
                this._readable = readable;
                this._writable = readable;
            }
            else if (readable instanceof stream.Writable) {
                this._writable = readable;
            }
            else {
                throw new Error('argument is not a stream');
            }
        }
        if (this._readable != null) {
            this._readable.on('data', (data) => {
                this._sortData(data);
            });
            this._readable.once('end', () => {
                this.emit('end');
            });
            this._readable.once('close', () => {
                this.emit('close');
            });
            this._readable.once('error', (err) => {
                this.emit('error', err);
            });
            this._readable.__PostStreamUsed = true;
        }
        if (this._writable != null) {
            //avoid duplicate registration
            if (!(this._writable instanceof stream.Duplex)) {
                this._writable.once('end', () => {
                    this.emit('end');
                });
                this._writable.once('error', (err) => {
                    this.emit('error', err);
                });
                this._writable.once('close', () => {
                    this.emit('close');
                });
            }
            this._writable.__PostStreamUsed = true;
        }
    }
    //sort received data
    _sortData(data) {
        if (this._remainData !== undefined) {
            data = Buffer.concat([this._remainData, data]);
        }
        if (this._new) {
            if (data.length < 4) {
                this._remainData = data;
                return;
            }
            const headerLength = data.readUInt32BE(0);
            if (data.length < headerLength) {
                this._remainData = data;
                return;
            }
            else {
                this._remainData = undefined;
            }
            this._new = false;
            this._receivedBody = Buffer.alloc(0);
            let index = 4;
            this._mode = data.readUInt8(index++);
            const titleLength = data.readUInt16BE(index);
            index += 2;
            this._receivedTitle = data.slice(index, index + titleLength).toString();
            index += titleLength;
            if (this._mode === 0) {
                this._remainBodyLength = data.readUInt32BE(index);
                index += 4;
            }
            data = data.slice(index);
        }
        if (this._mode === 0) {
            if (data.length >= this._remainBodyLength) {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, this._remainBodyLength)]);
                this._new = true;
                this.emit('data', this._receivedTitle, ...Serialize_1.parse(this._receivedBody));
                if (data.length > this._remainBodyLength)
                    this._sortData(data.slice(this._remainBodyLength));
            }
            else {
                this._remainBodyLength -= data.length;
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            }
        }
        else if (this._mode === 1) {
            const index = data.indexOf(this._endFlag);
            if (index === -1) {
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            }
            else {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, index)]);
                this._new = true;
                this.emit('data', this._receivedTitle, this._receivedBody);
                const remain = data.slice(index + this._endFlag.length);
                if (remain.length > 0)
                    this._sortData(remain);
            }
        }
    }
    send(title, ...data) {
        this._queue = this._send(title, data);
        return this._queue;
    }
    _send(title, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._writable != null) {
                yield this._queue;
                const header = [];
                // mode
                if (data[0] instanceof stream.Readable) {
                    const mode = Buffer.alloc(1); //mode:1
                    mode.writeUInt8(1, 0);
                    header.push(mode);
                }
                else {
                    const mode = Buffer.alloc(1); //mode:0
                    mode.writeUInt8(0, 0);
                    header.push(mode);
                }
                // title
                const bufferTitle = Buffer.from(title == null ? '' : title);
                const titleLength = Buffer.alloc(2);
                titleLength.writeUInt16BE(bufferTitle.length, 0);
                header.push(titleLength);
                header.push(bufferTitle);
                // body
                if (data[0] instanceof stream.Readable) {
                    const headerLength = Buffer.alloc(4);
                    headerLength.writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0), 0);
                    this._writable.write(headerLength);
                    header.forEach(item => this._writable.write(item));
                    const stream = data[0];
                    stream.pipe(this._writable, { end: false });
                    return new Promise((resolve) => {
                        stream.once('end', () => {
                            this._writable.write(this._endFlag);
                            resolve();
                        });
                    });
                }
                else {
                    const body = Serialize_1.serialize(data);
                    const bodyLength = Buffer.alloc(4);
                    bodyLength.writeUInt32BE(body.length, 0);
                    const headerLength = Buffer.alloc(4);
                    headerLength.writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0) + 4 /*bodyLength*/, 0);
                    this._writable.write(headerLength);
                    header.forEach(item => this._writable.write(item));
                    this._writable.write(bodyLength);
                    const isDrain = this._writable.write(body);
                    if (!isDrain) {
                        return new Promise((resolve) => {
                            this._writable.once('drain', resolve);
                        });
                    }
                    else {
                        return Promise.resolve();
                    }
                }
            }
        });
    }
    close() {
        if (this._writable !== undefined) {
            this._writable.end();
            this._writable = undefined;
        }
        if (this._writable !== undefined) {
            this._readable.pause();
            this._readable = undefined;
        }
    }
}
module.exports = PostStream;
