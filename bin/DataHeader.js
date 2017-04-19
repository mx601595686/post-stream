/**
 * Created by wujingtao on 2017/4/20.
 */

exports.toBuffer = function (mode, title, body) {
    let _headerLength = Buffer.alloc(4);
    let _mode = Buffer.alloc(1);
    let _titleLength = Buffer.alloc(2);
    let _title;
    let _bodyLength = Buffer.alloc(4);

    _mode.writeUInt8(mode, 0);
    _title = Buffer.from(title == null ? '' : title + '');
    _titleLength.writeUInt16BE(_title.length, 0);

    if (body !== undefined) _bodyLength.writeUInt32BE(body.length, 0);

    let lenght = 11 + _title.length;
    _headerLength.writeUInt32BE(lenght, 0);

    return Buffer.concat([_headerLength, _mode, _titleLength, _title, _bodyLength], lenght);
};

exports.parse = function (data) {
    if (data.length < 4) return false; //ensure can read header length
    const headerLength = data.readUInt32BE(0);
    if (data.length < headerLength) return false;

    const header = {};
    header.headerLength = headerLength;

    let index = 4;

    header.mode = data.readUInt8(index++);

    const titleLength = data.readUInt16BE(index);
    index += 2;

    header.title = data.slice(index, index + titleLength).toString();
    index += titleLength;

    header.bodyLength = data.readUInt32BE(index);

    return header;
};