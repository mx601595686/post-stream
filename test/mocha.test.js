const PostStream = require('..');
const stream = require('stream');
const expect = require('expect.js');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

describe('test construction', function () {
    it('use readable', function () {
        const read = new stream.Readable();
        const ps = new PostStream(read);
    });

    it('use writable', function () {
        const write = new stream.Writable();
        const ps = new PostStream(write);
    });

    it('use readable and writable', function () {
        const read = new stream.Readable();
        const write = new stream.Writable();
        const ps = new PostStream(read, write);
    });

    it('use duplex', function () {
        const duplex = new stream.Duplex();
        const ps = new PostStream(duplex);
    });

    it('multi times creation', function () {
        const duplex = new stream.Duplex();
        const ps = new PostStream(duplex);
        expect(function () {
            const ps2 = new PostStream(duplex);
        }).to.throwException((err) => {
            expect(err.message).to.be('stream has been used by PostStream');
        });
    });
});

describe('test send', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('use readable', function () {
        const ps = new PostStream(readable);
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });

    it('use writable', function () {
        const ps = new PostStream(writable);
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });

    it('use readable and writable', function () {
        const ps = new PostStream(readable, writable);
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });

    it('use duplex', function () {
        const ps = new PostStream(child.stdio[3]);
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });
});

describe('test data event', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('test basic type and Buffer', function (done) {
        const ps = new PostStream(readable, writable);
        let index = 1;

        ps.on('data', function (title, ...data) {
            switch (index++) {
                case 1:
                    expect(title).to.be('');
                    expect(data[0]).to.be(undefined);
                    break;
                case 2:
                    expect(title).to.be('test');
                    expect(data[0]).to.be(undefined);
                    break;
                case 3:
                    expect(title).to.be('test');
                    expect(data[0]).to.be(123);
                    break;
                case 4:
                    expect(title).to.be('test2');
                    expect(Buffer.from('ttt').equals(data.pop())).to.be.ok();
                    expect(data).to.be.eql(['a', 1, 3.5, true, null, undefined, { name: 'test' }]);
                    break;
                default:
                    expect(title).to.be('end');
                    expect(index).to.be(5);
                    done();
                    break;
            }
        });

        ps.send();
        ps.send('test');
        ps.send('test', 123);
        ps.send('test2', 'a', 1, 3.5, true, null, undefined, { name: 'test' }, Buffer.from('ttt'));
        ps.send('end');
    });

    it.only('test stream', function (done) {
        const ps = new PostStream(readable, writable);
        let index = 0;

        ps.on('data', function (title, data) {
            expect(title).to.be('stream');
            expect(data.toString()).to.be('abcdefghijklmn');
            if (++index === 5) {
                done();
            }
        });

        ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
    });
});

describe('test close', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.fork('./echo.js');
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('use readable', function () {
        const ps = new PostStream(readable);
        ps.close();
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });

    it('use writable', function () {
        const ps = new PostStream(writable);
        ps.close();
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });

    it('use readable and writable', function () {
        const ps = new PostStream(readable, writable);
        ps.close();
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });
});
