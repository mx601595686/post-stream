var _class, _temp;

/**
 * Created by wujingtao on 2017/4/1.
 */

const stream = require('stream');
const EventEmiter = require('events');
const { serialize, parse } = require('./BodySerialize');
const { DataSpliter } = require('./DataSpliter');
const DataSender = require('./DataSender');

/*
 data format: [\r\n«str»]->headerLength->mode->titleLength->title->[bodyLength]->body->[\r\n«end»]
 */

module.exports = (_temp = _class = class PostStream extends EventEmiter {

    /**
     * receive special data
     * @type {EventEmiter}
     */
    constructor(config = {}) {
        super();

        this.data = new EventEmiter();
        this.parseData = true;
        let readable = config.readable;
        let writable = config.writable;

        if (config.duplex instanceof stream.Duplex) {
            readable = config.duplex;
            writable = config.duplex;
        }

        if (readable != null) {
            if (readable.__PostStreamUsed === true) throw new Error('readable stream has been used by PostStream');

            if (!(readable instanceof stream.Readable)) {
                throw new Error('argument is not a readable stream');
            }
        }

        if (writable != null) {
            if (writable.__PostStreamUsed === true) throw new Error('writable stream has been used by PostStream');

            if (!(writable instanceof stream.Writable)) {
                throw new Error('second argument is not a writable stream');
            }
        }

        if (readable != null) {

            readable.on('end', () => {
                this.emit('end');
            });

            readable.on('close', () => {
                this.emit('close');
            });

            readable.on('error', err => {
                this.emit('error', err);
            });

            readable.__PostStreamUsed = true;

            this._dataSpliter = new DataSpliter(readable, config);
            this._dataSpliter.on('data', (mode, title, receivedBody) => {
                switch (mode) {
                    case 0:
                        {
                            if (this.parseData) {
                                this.emit('data', title, ...parse(receivedBody));
                                this.data.emit(title, ...parse(receivedBody));
                            } else {
                                this.emit('data', title, receivedBody);
                                this.data.emit(title, receivedBody);
                            }
                            break;
                        }
                    case 1:
                        {
                            this.emit('data', title, receivedBody);
                            this.data.emit(title, receivedBody);
                            break;
                        }
                }
            });
            this._dataSpliter.on('error', err => {
                this.emit('error', err);
            });
        }

        if (writable != null) {
            if (writable.__PostStreamUsed !== true) {
                writable.once('error', err => {
                    this.emit('error', err);
                });

                writable.once('close', () => {
                    this.emit('close');
                });
            }

            writable.__PostStreamUsed = true;
            this._dataSender = new DataSender(writable, config);
        }
    }

    /**
     * send data to stream
     * @param title {string}
     * @param data {Array}
     * @returns {Promise.<void>}
     */


    /**
     * is parsing received data
     * @type {boolean}
     */
    send(title, ...data) {
        if (data[0] instanceof stream.Readable) return this._dataSender.send(title, undefined, data[0]);else return this._dataSender.send(title, serialize(data));
    }

    /**
     * send serialized data to stream
     * @param title {string}
     * @param data {Buffer}
     * @returns {Promise.<void>}
     */
    sendSerializedData(title, data) {
        return this._dataSender.send(title, data);
    }

    async close() {
        await this._dataSpliter.close();
        await this._dataSender.close();
    }

}, _class.serialize = serialize, _class.parse = parse, _temp);