process.stdin.pipe(process.stdout);

if (process.connected) {
    process.on('message', data => {
        process.send(data);
    })
}