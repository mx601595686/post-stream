import stream = require('stream');

const enum dataType {
    number, string, boolean, null, undefined, Object, Buffer
}


export function serialize(data: any[]): Buffer {
    let count = 0;
    let divideIndex = 0;
    const divide: number[] = [];
    const bufferItems: Buffer[] = [];

    function push(type: dataType, data: Buffer) {
        const bt = Buffer.alloc(1);
        bt.writeUInt8(type, 0);

        count++;
        divideIndex += bt.length + data.length;
        divide.push(divideIndex);
        bufferItems.push(bt, data);
    }

    data.forEach(item => {
        switch (typeof item) {
            case 'number': {
                const bd = Buffer.alloc(8);
                bd.writeDoubleBE(item, 0);
                push(dataType.number, bd);
                break;
            }
            case 'string': {
                push(dataType.string, Buffer.from(item));
                break;
            }
            case 'boolean': {
                const bd = Buffer.alloc(1);
                bd.writeUInt8(item ? 1 : 0, 0);
                push(dataType.boolean, bd);
                break;
            }
            case 'undefined': {
                push(dataType.undefined, Buffer.alloc(0));
                break;
            }
            case 'object': {
                if (item === null) {
                    push(dataType.null, Buffer.alloc(0));
                } else if (Buffer.isBuffer(item)) {
                    push(dataType.Buffer, item);
                } else {
                    push(dataType.Object, Buffer.from(JSON.stringify(item)));
                }
            }
        }
    });

    const result: Buffer[] = [];

    const bc = Buffer.alloc(2);
    bc.writeUInt16BE(count, 0);
    result.push(bc);

    divide.forEach(item => {
        const bd = Buffer.alloc(4);
        bd.writeUInt32BE(item, 0);
        result.push(bd);
    });

    Array.prototype.push.apply(result, bufferItems);
    return Buffer.concat(result);
}

export function parse(data: Buffer): any[] {
    let previous = 0;
    const result: any[] = [];

    const count = data.readInt16BE(0);
    previous += 2;

    const divide = [];
    for (let i = 0; i < count; i++) {
        divide.push(data.readUInt32BE(previous))
        previous += 4;
    }

    data = data.slice(previous);

    previous = 0;
    divide.forEach(index => {
        const type = data.readUInt8(previous);
        previous++;

        switch (type) {
            case dataType.number: {
                result.push(data.readDoubleBE(previous));
                break;
            }
            case dataType.string: {
                const d = data.slice(previous, index);
                result.push(d.toString());
                break;
            }
            case dataType.boolean: {
                const d = data.readUInt8(previous);
                result.push(d === 1);
                break;
            }
            case dataType.undefined: {
                result.push(undefined);
                break;
            }
            case dataType.null: {
                result.push(null);
                break;
            }
            case dataType.Buffer: {
                result.push(data.slice(previous, index));
                break;
            }
            case dataType.Object: {
                const d = data.slice(previous, index);
                result.push(JSON.parse(d.toString()));
                break;
            }
            default: {
                throw new Error('PostStream read data type error. type: ' + type);
            }
        }

        previous = index;
    });

    return result;
}

