const PostStream = require('../../../bin/PostStream');
const net = require('net');

console.log(`child is pid ${process.pid}`);

const duplex = new net.Socket({
    fd: 3,
    readable: true,
    writable: true
});

const ps = new PostStream({duplex});

let index = 0;

ps.on('data', function (title, data) {
    if (title === 'start') {
        console.time('time');
    }

    if (title === 'index') {
        if (index !== data)
            throw new Error(index);
        index++;
    }

    if (title === 'end') {
        console.timeEnd('time');
    }
})

