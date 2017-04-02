/**
 * Created by wujingtao on 2017/4/1.
 */

const stream = require('stream');
const events = require('events');
const {serialize, parse} = require('./Serialize');

/*
 data format: headerLength->mode->titleLength->title->?bodyLength->body
 */

module.exports = class PostStream extends events {

    static _endFlag = Buffer.from('\r\n«end»');
    static serialize = serialize;
    static parse = parse;

    _readable; // stream.Readable | stream.Duplex
    _writable; // stream.Writable | stream.Duplex
    _receivedBody; // Buffer
    _remainData; // Buffer //when received data length too short，can`t decode header，the data will be store here
    _remainBodyLength = 0;
    _receivedTitle; //string
    _new = true; //is new data
    _mode = 0;  //0: fixed length，1：unfixed length(use _endFlag to finding end)
    _queue = Promise.resolve(); // sending queue
    _emitDataEvent = false; // if user has registered data event

    /**
     * receive special data
     * @type {EventEmiter}
     */
    data = new events();

    /**
     * is parsing received data
     * @type {boolean}
     */
    parseData = true;

    constructor(readable, writable) {
        super();

        if (readable != null) {
            if (readable.__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');

            if (readable instanceof stream.Readable) {
                this._readable = readable;
            } else {
                throw new Error('argument is not a readable stream');
            }
        }

        if (writable != null) {
            if (writable.__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');

            if (writable instanceof stream.Writable) {
                this._writable = writable;
            } else {
                throw new Error('second argument is not a writable stream');
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
                this.close();
            });

            this._readable.__PostStreamUsed = true;
        }

        if (this._writable != null) {
            if (this._writable.__PostStreamUsed !== true) {
                this._writable.once('error', (err) => {
                    this.emit('error', err);
                    this.close();
                });

                this._writable.once('close', () => {
                    this.emit('close');
                });
            }

            this._writable.__PostStreamUsed = true;
        }

        this.on('newListener', event => {
            if (event === 'data')
                this._emitDataEvent = true;
        });
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
            } else {
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

                const body = this.parseData ? parse(this._receivedBody) : [this._receivedBody];

                if (this._emitDataEvent)
                    this.emit('data', this._receivedTitle, ...body);

                this.data.emit(this._receivedTitle, ...body);

                if (data.length > this._remainBodyLength)
                    this._sortData(data.slice(this._remainBodyLength));
            } else {
                this._remainBodyLength -= data.length;
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            }
        } else if (this._mode === 1) {
            const index = data.indexOf(PostStream._endFlag);
            if (index === -1) {
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            } else {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, index)]);

                this._new = true;
                if (this._emitDataEvent)
                    this.emit('data', this._receivedTitle, this._receivedBody);

                this.data.emit(this._receivedTitle, this._receivedBody);

                if (index + PostStream._endFlag.length < data.length) {
                    const remain = data.slice(index + PostStream._endFlag.length);
                    this._sortData(remain);
                }
            }
        }
    }

    /**
     * send data to stream
     * @param title {string}
     * @param data {Array}
     * @returns {Promise.<void>}
     */
    send(title, ...data) {
        this._queue = this._send(title, data);
        return this._queue;
    }

    /**
     * send serialized data to stream
     * @param title {string}
     * @param data {Buffer}
     * @returns {Promise.<void>}
     */
    sendSerializedData(title, data) {
        this._queue = this._send(title, data, true);
        return this._queue;
    }

    close() {
        return this._queue.then(() => {
            this.removeAllListeners();
            this.data.removeAllListeners();

            if (this._writable !== undefined) {
                this._writable.end();
                this._writable = undefined;
            }
            if (this._readable !== undefined) {
                this._readable.pause();
                this._readable = undefined;
            }
        });
    }

    async _send(title, data, isSerialized) {
        await this._queue;

        if (this._writable != null) {

            const header = [
                Buffer.alloc(4)/*headerLength*/,
                Buffer.alloc(1)/*mode*/,
                Buffer.alloc(2)/*titleLength*/
                /*title*/
                /*bodyLength:Buffer.alloc(4)*/
            ];

            // title
            header[3] = Buffer.from(title == null ? '' : title);
            header[2].writeUInt16BE(header[3].length, 0);

            // body
            if (data[0] instanceof stream.Readable) { //mode: 1
                header[1].writeUInt8(1, 0);
                header[0].writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0), 0);
                header.forEach(item => this._writable.write(item));

                const stream = (data[0]);

                return new Promise((resolve) => {
                    stream.once('end', () => {
                        this._writable.write(PostStream._endFlag);
                        resolve();
                    });

                    stream.pipe(this._writable, {end: false});
                });
            } else { //mode: 0
                header[1].writeUInt8(0, 0);

                const body = isSerialized ? data : serialize(data);

                header[4] = Buffer.alloc(4);
                /*bodyLength*/
                header[4].writeUInt32BE(body.length, 0);

                header[0].writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0), 0);
                header.forEach(item => this._writable.write(item));

                const isDrain = this._writable.write(body);

                if (!isDrain) {
                    return new Promise((resolve) => {
                        this._writable.once('drain', resolve);
                    });
                }
            }
        }
    }
};