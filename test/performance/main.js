const PostStream = require('../../');
const child_process = require('child_process');
const path = require('path');

console.log(`main is pid ${process.pid}`);

const child = child_process.spawn(process.execPath, [path.resolve(__dirname, './child.js')], {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe']
});

const ps = new PostStream({
    duplex:child.stdio[3]
});

(async function () {
    await ps.send('start');

    for (var index = 0; index < 10000; index++) {
        await ps.send('index', index);
    }

    await ps.send('end');
})()
