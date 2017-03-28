import stream = require('stream');
import events = require('events');
import { serialize, parse } from './Serialize';

/*
    data format: headerLength->mode->titleLength->title->?bodyLength->body
    body format: count->divide[]->item(datatype->data)
*/

class PostStream extends events.EventEmitter {

    private _readable: stream.Readable | stream.Duplex;
    private _writable: stream.Writable | stream.Duplex;

    private readonly _endFlag = Buffer.from('\r\n«end»');
    private _receivedBody: Buffer;
    private _remainData: Buffer;  //when received data length too short，can`t decode header，the data will be store here
    private _remainBodyLength = 0;
    private _receivedTitle: string;
    private _new = true; //is new data
    private _mode = 0;  //0: fixed length，1：unfixed length(use _endFlag to finding end)
    private _queue = Promise.resolve(); // sending queue

    constructor(duplex: stream.Duplex);
    constructor(writable: stream.Writable);
    constructor(readable: stream.Readable, writable?: stream.Writable);
    constructor(readable: stream.Readable | stream.Duplex | stream.Writable, writable?: stream.Writable) {
        super();

        if (writable != null) {
            if ((<any>writable).__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');

            if (writable instanceof stream.Writable) {
                this._writable = writable;
            } else {
                throw new Error('second argument is not a writable stream');
            }
        }

        if (readable != null) {
            if ((<any>readable).__PostStreamUsed === true)
                throw new Error('stream has been used by PostStream');

            if (readable instanceof stream.Readable) {
                this._readable = readable;
            } else if (readable instanceof stream.Duplex) {
                this._readable = readable;
                this._writable = readable;
            } else if (readable instanceof stream.Writable) {
                this._writable = readable;
            } else {
                throw new Error('argument is not a stream');
            }
        }

        if (this._readable != null) {
            this._readable.on('data', (data: Buffer) => {
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

            (<any>this._readable).__PostStreamUsed = true;
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

            (<any>this._writable).__PostStreamUsed = true;
        }
    }

    //sort received data
    private _sortData(data: Buffer) {
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
                this.emit('data', this._receivedTitle, ...parse(this._receivedBody));

                if (data.length > this._remainBodyLength)
                    this._sortData(data.slice(this._remainBodyLength));
            } else {
                this._remainBodyLength -= data.length;
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            }
        } else if (this._mode === 1) {
            const index = data.indexOf(this._endFlag);
            if (index === -1) {
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            } else {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, index)]);

                this._new = true;
                this.emit('data', this._receivedTitle, this._receivedBody);

                if (index + this._endFlag.length < data.length) {
                    const remain = data.slice(index + this._endFlag.length);
                    this._sortData(remain);
                }
            }
        }
    }

    send(title: string, data: stream.Readable | stream.Duplex): Promise<void>;
    send(title: string, ...data: any[]): Promise<void> {
        this._queue = this._send(title, data);
        return this._queue;
    }

    async _send(title: string, data: any[]): Promise<void> {
        await this._queue;

        if (this._writable != null) {

            const header: Buffer[] = [
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
            if (data[0] instanceof stream.Readable) {
                header[1].writeUInt8(1, 0); //mode: 1
                header[0].writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0), 0);
                header.forEach(item => this._writable.write(item));

                const stream = (<stream.Readable>data[0]);

                return new Promise<void>((resolve) => {
                    stream.once('end', () => {
                        this._writable.write(this._endFlag);
                        resolve();
                    });

                    stream.pipe(this._writable, { end: false });
                });
            } else {
                header[1].writeUInt8(0, 0); //mode: 0

                const body = serialize(data);
                header[4] = Buffer.alloc(4); /*bodyLength*/
                header[4].writeUInt32BE(body.length, 0);

                header[0].writeUInt32BE(header.reduce((pre, cur) => pre + cur.length, 0), 0);
                header.forEach(item => this._writable.write(item));

                const isDrain = this._writable.write(body);

                if (!isDrain) {
                    return new Promise<void>((resolve) => {
                        this._writable.once('drain', resolve);
                    });
                } else {
                    return Promise.resolve();
                }
            }
        }
    }


    close(): Promise<void> {
        return this._queue.then(() => {
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
}

export = PostStream;