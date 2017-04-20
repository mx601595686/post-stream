/**
 * Created by wujingtao on 2017/4/20.
 */

const stream = require('stream');
const DataHeader = require('./DataHeader');
const { startFlag, endFlag, defaultMaxSize } = require('./DataSpliter');

module.exports = class DataSender {

    constructor(writable, config = {}) {
        this.maxSize = defaultMaxSize;
        this._queue = Promise.resolve();

        if ('number' === typeof config.maxSize) this.maxSize = config.maxSize;

        this._writableStream = writable;

        writable.once('error', this.close.bind(this));
        writable.once('close', this.close.bind(this));
    } // sending queue


    send(title, buffer, stream) {
        if ('string' !== typeof title) throw new Error('title is not string');

        this._queue = this._send(title, buffer, stream);
        return this._queue;
    }

    async _send(title, buffer, stream) {
        if (this._writableStream === undefined) return;

        await this._queue;
        if (stream !== undefined) {
            //mode: 1
            this._writableStream.write(startFlag);
            this._writableStream.write(DataHeader.toBuffer(1, title));

            return new Promise(resolve => {
                stream.once('end', () => {
                    this._writableStream.write(endFlag);
                    resolve();
                });

                stream.pipe(this._writableStream, { end: false });
            });
        } else {
            //mode: 0
            this._writableStream.write(startFlag);
            this._writableStream.write(DataHeader.toBuffer(0, title, buffer));
            const isDrain = this._writableStream.write(buffer);

            if (!isDrain) {
                return new Promise(resolve => {
                    this._writableStream.once('drain', resolve);
                });
            }
        }
    }

    close() {
        this._queue = (async () => {
            await this._queue;
            this._writableStream.end();
            this._writableStream = undefined;
        })();

        return this._queue;
    }
};