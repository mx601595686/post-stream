const PostStream = require('..');
const stream = require('stream');
const expect = require('expect.js');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

process.on('unhandledRejection',err => console.error(err));

describe('test construction', function () {
    it('use readable', function () {
        const readable = new stream.Readable();
        const ps = new PostStream({readable});
    });

    it('use writable', function () {
        const writable = new stream.Writable();
        const ps = new PostStream({writable});
    });

    it('use readable and writable', function () {
        const readable = new stream.Readable();
        const writable = new stream.Writable();
        const ps = new PostStream({readable, writable});
    });

    it('use duplex', function () {
        const duplex = new stream.Duplex();
        const ps = new PostStream({duplex});
    });

    it('multi times creation', function () {
        const duplex = new stream.Duplex();
        const ps = new PostStream({duplex});
        expect(function () {
            const ps2 = new PostStream({duplex});
        }).to.throwException((err) => {
            expect(err.message).to.be('readable stream has been used by PostStream');
        });
    });
});

describe('test send', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('use readable', function (done) {
        const ps = new PostStream({readable});
        try{
            ps.send();
            ps.send('test');
            ps.send('test', 123);
        }catch (e){
            done();
        }
    });

    it('use writable', async function () {
        const ps = new PostStream({writable});
        await ps.send();
        await ps.send('test');
        await ps.send('test', 123);
    });

    it('use readable and writable', function () {
        const ps = new PostStream({readable, writable});
        ps.send();
        ps.send('test');
        ps.send('test', 123);
    });
});

describe('test parse data', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('test basic type and Buffer', function (done) {
        const ps = new PostStream({readable, writable});
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
                    expect(data).to.be.eql(['a', 1, 3.5, true, null, undefined, {name: 'test'}]);
                    break;
                default:
                    expect(title).to.be('end');
                    expect(index).to.be(6);
                    done();
                    break;
            }
        });

        ps.send();
        ps.send('test');
        ps.send('test', 123);
        ps.send('test2', 'a', 1, 3.5, true, null, undefined, {name: 'test'}, Buffer.from('ttt'));
        ps.send('end');
    });

    it('test stream', function (done) {
        const ps = new PostStream({readable, writable});
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
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('test basic type and Buffer', async function () {
        const ps = new PostStream({readable, writable});
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
                default:
                    throw new Error('close() is no effect');
                    break;
            }
        });

        await ps.send();
        await ps.send('test');
        await ps.send('test', 123);
        await ps.close();
        await ps.send('test2', 'a', 1, 3.5, true, null, undefined, {name: 'test'}, Buffer.from('ttt'));
        await ps.send('end');
    });

    it('test stream', async function () {
        const ps = new PostStream({readable, writable});
        let index = 1;

        ps.on('data', function (title, data) {
            expect(title).to.be('stream');
            expect(data.toString()).to.be('abcdefghijklmn');
            if (index++ > 3)
                throw new Error('close() is no effect');
        });

        await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        await ps.close();
        await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
    });
});

describe('test accuracy', function () {
    this.timeout(30000);

    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('no order :test basic type and Buffer', function (done) {
        const ps = new PostStream({readable, writable});

        const testItems = [
            null,
            undefined,
            -11,
            3.56365,
            true,
            false,
            'test',
            {'test': 123456},
            [1, 2, {'test': 123456}]
        ];

        ps.on('data', function (title, data) {
            expect(data).to.be.eql(testItems[title]);
        });

        for (let i = 0; i < 1000; i++) {
            const index = Math.floor(Math.random() * testItems.length);
            ps.send(index + '', testItems[index]);
        }

        setTimeout(function () {
            done();
        }, 2000);
    });

    it('in order :test basic type and Buffer', async function () {
        const ps = new PostStream({readable, writable});

        const testItems = [
            null,
            undefined,
            -11,
            3.56365,
            true,
            false,
            'test',
            {'test': 123456},
            [1, 2, {'test': 123456}]
        ];

        ps.on('data', function (title, data) {
            expect(data).to.be.eql(testItems[title]);
        });

        for (let i = 0; i < 5000; i++) {
            const index = Math.floor(Math.random() * testItems.length);
            await ps.send(index + '', testItems[index]);
        }
    });

    it('no order :test stream', function (done) {
        const ps = new PostStream({readable, writable});

        ps.on('data', function (title, data) {
            expect(title).to.be('stream');
            expect(data.toString()).to.be('abcdefghijklmn');
        });

        for (var index = 0; index < 100; index++) {
            ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        }

        setTimeout(function () {
            done();
        }, 6000);
    });

    it('in order :test stream', async function () {
        const ps = new PostStream({readable, writable});

        ps.on('data', function (title, data) {
            expect(title).to.be('stream');
            expect(data.toString()).to.be('abcdefghijklmn');
        });

        for (var index = 0; index < 1000; index++) {
            await ps.send('stream', fs.createReadStream(path.resolve(__dirname, './testFile.txt')));
        }
    });
});

describe('test don`t auto parse data', function () {
    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    it('don`t parse Data', function (done) {
        const ps = new PostStream({readable, writable});
        ps.parseData = false;
        ps.data.on('original', data => {
            expect(Buffer.isBuffer(data)).to.be.ok();
            data = PostStream.parse(data);
            expect(data[0]).to.be('hello');
            done();
        });
        ps.send('original', 'hello');
    });

    it('send serialized data', function (done) {
        const ps = new PostStream({readable, writable});
        ps.data.on('original', data => {
            expect(data).to.be('hello');
            done();
        });
        ps.sendSerializedData('original', PostStream.serialize(['hello']));
    });
});