let last = Promise.resolve();

async function test(i) {
    await last;
    return new Promise((resolve) => {
        setTimeout(function () {
            console.log(i);
            resolve();
        }, 100);
    });
}

for (let i = 0; i < 100; i++) {
    last = test(i);
}