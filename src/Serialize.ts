import stream = require('stream');

const enum bodyDataType {
    number, string, boolean, null, undefined, Object, Buffer, ObjectWithBuffer
}

type dataType = number | string | boolean | null | undefined | Object | Buffer | stream.Readable;

function serialize(data: dataType): Buffer {
    if ('number' === typeof data) {
        const bf = Buffer.alloc(9);
        bf.writeUInt8(bodyDataType.number, 0);
        bf.writeDoubleBE(data, 1);
        return bf;

    } else if ('string' === typeof data) {
        const bf = Buffer.alloc(1);
        bf.writeUInt8(bodyDataType.string, 0);
        return Buffer.concat([bf, Buffer.from(data)]);

    } else if ('boolean' === typeof data) {
        const bf = Buffer.alloc(2);
        bf.writeUInt8(bodyDataType.boolean, 0);
        bf.writeDoubleBE(data ? 1 : 0, 1);
        return bf;

    } else if (null === data) {

    } else if (undefined === data) {

    } else if ('number' === typeof data) {

    } else if ('number' === typeof data) {

    } else if ('number' === typeof data) {

    } else if ('number' === typeof data) {

    }
}

function parse(data: Buffer): any {

}

