import stream = require('stream');
import events = require('events');


class PostStream extends events.EventEmitter {

    private readonly _readable: stream.Readable | stream.Duplex;
    private readonly _writable: stream.Writable | stream.Duplex;

    private readonly _endFlag = Buffer.from('\r\n«end»');
    private _receivedTitle: string;
    private _receivedBody: Buffer;
    private _new = true; //is new data
    private _mode = 0;  //0: fixed length，1：unfixed length(use _endFlag to finding end)
    private _remainBodyLength = 0;

    constructor(duplex: stream.Duplex);
    constructor(writable: stream.Writable);
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

            this._readable.once('error', (err) => {
                this.emit('error', err);
            });

            (<any>this._readable).__PostStreamUsed = true;
        }

        if (this._writable != null) {
            //avoid duplicate registration
            if (!(this._readable instanceof stream.Duplex)) {
                this._readable.once('end', () => {
                    this.emit('end');
                });

                this._readable.once('error', (err) => {
                    this.emit('error', err);
                });
            }

            (<any>this._readable).__PostStreamUsed = true;
        }
    }

    //sort received data
    private _sortData(data: Buffer) {
        if (this._new) {
            this._new = false;
            this._receivedBody = Buffer.alloc(0);

            //data header format: mode->titleLength->title->?bodyLength->body

            this._mode = data.readUInt8(0);
            const titleLength = data.readUInt16BE(1);
            this._receivedTitle = data.slice(3, 3 + titleLength).toString();
            if (this._mode === 0) {
                this._remainBodyLength = data.readUInt32BE(3 + titleLength);
                data = data.slice((3 + titleLength) + 4);
            } else if (this._mode === 1) {
                data = data.slice(3 + titleLength);
            }
        }

        if (this._mode === 0) {
            if (data.length >= this._remainBodyLength) {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, this._remainBodyLength)]);
                this._new = true;
                this.emit('data', this._receivedBody, this._receivedTitle);

                if (data.length > this._remainBodyLength)
                    this._sortData(data.slice(this._remainBodyLength));
            } else {
                this._remainBodyLength -= data.length;
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            }
        } else if (this._mode === 1) {
            const index = data.lastIndexOf(this._endFlag);
            if (index === -1) {
                this._receivedBody = Buffer.concat([this._receivedBody, data]);
            } else {
                this._receivedBody = Buffer.concat([this._receivedBody, data.slice(0, index)]);
                this._new = true;
                this.emit('data', this._receivedBody, this._receivedTitle);

                const remain = data.slice(index, this._endFlag.length);
                if (remain.length > 0)
                    this._sortData(data.slice(this._remainBodyLength));
            }
        }
    }



    send(data:any, title?: string): Promise<void> {
        if (this._writable != null) {

            if (data == null) {
                data = Buffer.alloc(0);
            }

            let bufferTitle: Buffer;
            if (title == null) {
                bufferTitle = Buffer.alloc(0);
            } else {
                bufferTitle = Buffer.from(title);
            }

            if (data instanceof stream.Readable) {
                this._writable.write(Buffer.alloc(1).writeUInt8(1, 0));  //mode:1
                this._writable.write(Buffer.alloc(2).writeUInt16BE(bufferTitle.length, 0));
                this._writable.write(bufferTitle);
                <stream.Readable>data
                    .pipe(this._writable, { end: false })
                    .once('end', () => {
                        this._writable.write(this._endFlag);
                    });
            } else {
                this._writable.write(Buffer.alloc(1).writeUInt8(0, 0));  //mode:0
                this._writable.write(Buffer.alloc(2).writeUInt16BE(bufferTitle.length, 0));
                this._writable.write(bufferTitle);

            }

            this._writable.write(bufferTitle);
            this._writable.write(PostStream.titleFlag);

            this._writable.write(data);
            this._writable.write(PostStream.bodyFlag);

            const isDrain = this._writable.write(PostStream.endFlag);

            if (!isDrain) {
                return new Promise<void>((resolve) => {
                    this._writable.once('drain', resolve);
                });
            }
        }

        return Promise.resolve();
    }
}