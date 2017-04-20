# post-stream
Efficiently and conveniently send number, string, boolean, null, undefined, object, buffer or stream to a stream.

`npm install --save post-stream`

---

## API

### Constructor

```javascript
//Create a stream controler
new PostStream(config);
```

`config`:
* `readable` readable stream
* `writable` writable stream
* `duplex` duplex stream (such as tcp socket)
* `maxSize` data fragment max byte size, default 16MB.
If when sending data greater than `maxSize` will throw a error.
If when receiving data greater than `maxSize` ,this data will be discard.

### StaticClassProperty

##### `serialize(data: Array): Buffer`
Serilize data. Pass a array, item type can be number, string, boolean, null, undefined, object or buffer.

##### `parse(data: Buffer): Array`
Parse data. Pass a has been serialized buffer.

### ClassProperty

##### `data: EventEmiter`
This is a `EventEmiter`. Received data`s title is event name.

```javascript
const ps = new PostStream({readable, writable});
ps.data.once('test', function(data){ data === 123 });
await ps.send('test', 123);
```

##### `parseData: boolean`
Parse received data. Default is true. If you set false,
 then you need use `PostStream.parse` to parse every received data.

```javascript
const ps = new PostStream({readable, writable});
ps.parseData = false;
ps.data.once('test', function(data){
    const parsed = PostStream.parse(data); //return array
});
await ps.send('test', 123);
```

### ClassMethod

##### `send(title: string, ...data: any[]): Promise<void>`

Send number, string, boolean, null, undefined, object or buffer to stream. 
The first argument must be a string, it is used for description the data. After that you can pass zero or more data as arguments. If a argument is object or array，it will be serialized( use JSON.stringify ). If you want send a buffer, don`t put it in object or array. This function will return a promise object.
```javascript
const ps = new PostStream({readable, writable});
await ps.send('test');
await ps.send('test1', 123);
await ps.send('test2', 'string', 1, 3.5, true, null, undefined, { name: 'test' }, [1,2,3], Buffer.from('ttt'));
```



##### `send(title: string, data: stream.Readable | stream.Duplex): Promise<void>;`

Send a stream`s data to stream. You can only pass one stream as second argument. Other arguments will be ignore. Receiver side will receive a buffer, data comes from the send stream. This function will return a promise object.

```javascript
const ps = new PostStream({readable, writable});
await ps.send('stream', fs.createReadStream('./testFile.txt'));
await ps.send('stream', fs.createReadStream('./testFile2.txt'));
```


##### `sendSerializedData(title: string, data: Buffer): Promise<void>;`

Directly send using `PostStream.serialize` serialized data.

```javascript
const ps = new PostStream({readable, writable});
await ps.sendSerializedData('original', PostStream.serialize(['hello']));
```


##### close

`close(): Promise<void>`

Close readable stream and writable stream.

```javascript
const ps = new PostStream({readable, writable});
await ps.close();
```

### Event

##### `'data'`

Receive all data. This will be triggered when PostStream has received data. The first parameter is title, after that will be zero or more data, determined by when sending.

```javascript
const ps = new PostStream(readableStream, writableStream);
ps.on('data', function (title, data1, data2[, ...data3]) { });
```

##### `'end'`

This will be triggered when the be controled stream trigger end event.

##### `'close'`

This will be triggered when the be controled stream trigger close event.

##### `'error'`

This will be triggered when the be controled stream trigger error event or when parsing data error.

### Attention
If you want to use `pipe` to communicate with child process, you would better use two `pipe` instead of one.
Because of don\`t know why child send data to parent will lost one data fragment.(this is not this package\`s problem)

```javascript
//parent

const child_process = require('child_process');
const path = require('path');
const PostStream = require('post-stream');

const child = child_process.spawn(process.execPath, [path.resolve('./child.js')], {
    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe']
});
const ps = new PostStream({readable:child.stdio[3], writable:child.stdio[4]});
ps.data.on('main', data => {
    console.log('main:', data)
});
ps.send('child',123);
```
```javascript
//child
const fs = require('fs');
const PostStream = require('post-stream');

let readable = fs.createReadStream(null,{fd:4});
let writable = fs.createWriteStream(null,{fd:3});
const ps = new PostStream({readable, writable});
ps.data.on('child', data => {
    ps.send('main', data);
});
```