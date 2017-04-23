const PostStream = require('../../..');
const child_process = require('child_process');
const path = require('path');

console.log(`main is pid ${process.pid}`);

const child = child_process.spawn(process.execPath, [path.resolve(__dirname, './child.js')], {
    stdio: ['inherit', 'inherit', 'inherit', 'pipe']
});

const ps = new PostStream({
    duplex:child.stdio[3]
});

ps.send('start');

for (let index = 0; index < 10000; index++) {
    ps.send('index', index);
}

ps.send('end');

//10000 : 296.853ms
