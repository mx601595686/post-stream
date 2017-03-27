/// <reference types="node" />
import stream = require('stream');
import events = require('events');
declare class PostStream extends events.EventEmitter {
    private _readable;
    private _writable;
    private readonly _endFlag;
    private _receivedBody;
    private _remainData;
    private _remainBodyLength;
    private _receivedTitle;
    private _new;
    private _mode;
    private _queue;
    constructor(duplex: stream.Duplex);
    constructor(writable: stream.Writable);
    constructor(readable: stream.Readable, writable?: stream.Writable);
    private _sortData(data);
    send(title: string, data: stream.Readable | stream.Duplex): Promise<void>;
    _send(title: string, data: any[]): Promise<void>;
    close(): void;
}
export = PostStream;
