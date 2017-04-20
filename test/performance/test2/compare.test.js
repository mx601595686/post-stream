const PostStream = require('../../..');
const stream = require('stream');
const expect = require('expect.js');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');

describe('compare to child_process ipc', function () {
    this.timeout(6000);

    let readable;
    let writable;
    let child;

    beforeEach(function () {
        child = child_process.spawn(process.execPath, [path.resolve(__dirname, './echo.js')], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        readable = child.stdout;
        writable = child.stdin;
    });

    afterEach(function () {
        child.kill();
    });

    describe('number', function () {
        it('child_process ipc', function (done) {
            child.on('message', index => {
                if (index === 1000)
                    done();
            })
            for (let i = 0; i <= 1000; i++) {
                child.send(i);
            }
        });

        it('PostStream', function (done) {
            const ps = new PostStream({readable, writable});

            ps.on('data', (t, index) => {
                if (index === 1000)
                    done();
            })

            for (let i = 0; i <= 1000; i++) {
                ps.send('', i);
            }
        })
    });

    describe('string', function () {
        it('child_process ipc', function (done) {
            child.on('message', index => {
                if (index === '1000')
                    done();
            })
            for (let i = 0; i <= 1000; i++) {
                child.send(i + '');
            }
        });

        it('PostStream', function (done) {
            const ps = new PostStream({readable, writable});

            ps.on('data', (t, index) => {
                if (index === '1000')
                    done();
            })

            for (let i = 0; i <= 1000; i++) {
                ps.send('', i + '');
            }
        })
    });

    describe('null', function () {
        it('child_process ipc', function (done) {
            var index = 0;
            child.on('message', value => {
                if (value === null)
                    index++;
                if (index === 1000)
                    done();
            })
            for (let i = 0; i <= 1000; i++) {
                child.send(null);
            }
        });

        it('PostStream', function (done) {
            const ps = new PostStream({readable, writable});

            var index = 0;

            ps.on('data', (t, value) => {
                if (value === null)
                    index++;
                if (index === 1000)
                    done();
            })

            for (let i = 0; i <= 1000; i++) {
                ps.send('', null);
            }
        })
    });

    describe('object', function () {
        it('child_process ipc', function (done) {
            child.on('message', data => {
                if (data.index === 1000)
                    done();
            })
            for (let i = 0; i <= 1000; i++) {
                child.send({ index: i });
            }
        });

        it('PostStream', function (done) {
            const ps = new PostStream({readable, writable});

            ps.on('data', (t, data) => {
                if (data.index === 1000)
                    done();
            });

            for (let i = 0; i <= 1000; i++) {
                ps.send('', { index: i });
            }
        });
    });
});