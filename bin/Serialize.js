"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function serialize(data) {
    let count = 0;
    let divideIndex = 0;
    const divide = [];
    const bufferItems = [];
    function push(type, data) {
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
                push(0 /* number */, bd);
                break;
            }
            case 'string': {
                push(1 /* string */, Buffer.from(item));
                break;
            }
            case 'boolean': {
                const bd = Buffer.alloc(1);
                bd.writeUInt8(item ? 1 : 0, 0);
                push(2 /* boolean */, bd);
                break;
            }
            case 'undefined': {
                push(4 /* undefined */, Buffer.alloc(0));
                break;
            }
            case 'object': {
                if (item === null) {
                    push(3 /* null */, Buffer.alloc(0));
                }
                else if (Buffer.isBuffer(item)) {
                    push(6 /* Buffer */, item);
                }
                else {
                    push(5 /* Object */, Buffer.from(JSON.stringify(item)));
                }
            }
        }
    });
    const result = [];
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
exports.serialize = serialize;
function parse(data) {
    let previous = 0;
    const result = [];
    const count = data.readInt16BE(0);
    previous += 2;
    const divide = [];
    for (let i = 0; i < count; i++) {
        divide.push(data.readUInt32BE(previous));
        previous += 4;
    }
    data = data.slice(previous);
    previous = 0;
    divide.forEach(index => {
        const type = data.readUInt8(previous);
        previous++;
        switch (type) {
            case 0 /* number */: {
                result.push(data.readDoubleBE(previous));
                break;
            }
            case 1 /* string */: {
                const d = data.slice(previous, index);
                result.push(d.toString());
                break;
            }
            case 2 /* boolean */: {
                const d = data.readUInt8(previous);
                result.push(d === 1);
                break;
            }
            case 4 /* undefined */: {
                result.push(undefined);
                break;
            }
            case 3 /* null */: {
                result.push(null);
                break;
            }
            case 6 /* Buffer */: {
                result.push(data.slice(previous, index));
                break;
            }
            case 5 /* Object */: {
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
exports.parse = parse;
