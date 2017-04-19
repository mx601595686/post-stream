/**
 * Created by wujingtao on 2017/4/19.
 */

const EventEmiter = require('events');
const DataHeader = require('./DataHeader');

const startFlag = Buffer.from('\r\n«str»');
const endFlag = Buffer.from('\r\n«end»');
const defaultMaxSize = 1024 * 1024 * 16; //data fragment max byte size, default 16MB

/*
 * Split stream data
 *
 * event:'data'  receive has been splited data. return mode, title, receivedBody
 * */
exports.DataSpliter = class DataSpliter extends EventEmiter {
    //Buffer
    constructor(readable, config = {}) {
        super();
        this.maxSize = defaultMaxSize;

        this._push = data => {
            try {
                this._findStartAndConcatData(data) && this._getHeader() && this._getBody() && this._clean();
            } catch (e) {
                this.emit('error', e);
            }
        };

        if ('number' === typeof config.maxSize) this.maxSize = config.maxSize;

        this._readableStream = readable;

        readable.on('data', this._push);
        readable.once('close', this.close.bind(this));
        readable.once('error', this.close.bind(this));
    }

    /*
     * mode = 0;  //0: fixed length，1：unfixed length(use _endFlag to finding end)
     * bodyLength;
     * title;
     * */


    _findStartAndConcatData(data) {
        if (this._receivedFragment === undefined) {
            //find new data fragment
            const index = data.indexOf(startFlag);
            if (index !== -1) {
                this._receivedFragment = data.slice(index + startFlag.length);
                return true;
            }
        } else {
            //concat data
            const length = this._receivedFragment.length + data.length;
            if (length > this.maxSize) {
                //if greater than maxSize,ignore this data fragment
                return this._clean(data);
            }

            this._receivedFragment = Buffer.concat([this._receivedFragment, data], length);
            return true;
        }
    }

    _getHeader() {
        if (this._receivedHeader === undefined) {
            const data = this._receivedFragment;
            const result = DataHeader.parse(data);

            if (result) {
                if (result.mode === 0 && result.bodyLength > this.maxSize) return this._clean(data);

                this._receivedHeader = result;
            } else return false;

            this._receivedFragment = this._receivedFragment.slice(result.headerLength);
        }

        return true;
    }

    _getBody() {
        const { mode, bodyLength, title } = this._receivedHeader;
        const data = this._receivedFragment;

        switch (mode) {
            case 0:
                {
                    //fixed length mode
                    if (data.length >= bodyLength) {
                        const receivedBody = data.slice(0, bodyLength);
                        this.emit('data', mode, title, receivedBody);

                        if (data.length > bodyLength) {
                            //remain data
                            return this._clean(data.slice(bodyLength));
                        }

                        return true;
                    }
                    break;
                }
            case 1:
                {
                    const index = data.indexOf(endFlag, bodyLength);

                    if (index !== -1) {
                        const receivedBody = data.slice(0, index);
                        this.emit('data', mode, title, receivedBody);

                        if (index + endFlag.length < data.length) {
                            //remain data
                            return this._clean(data.slice(index + endFlag.length));
                        }

                        return true;
                    } else {
                        this._receivedHeader.bodyLength = data.length;
                    }
                    break;
                }
            default:
                {
                    return true;
                }
        }
    }

    _clean(data) {
        this._receivedHeader = undefined;
        this._receivedFragment = undefined;

        if (data !== undefined) this._push(data);
    }

    close() {
        if (this._readableStream !== undefined) {
            this._readableStream.removeListener('data', this._push);
            this._readableStream = undefined;
        }
    }
};

exports.startFlag = startFlag;
exports.endFlag = endFlag;
exports.defaultMaxSize = defaultMaxSize;