# post-stream
Send number, string, boolean, null, undefined, object, buffer or stream to a stream efficiently and conveniently.

`npm install --save post-stream`

---

## API

### Constructor

```javascript
//Create a stream controler, it can only receive data
new PostStream(readableStream);

//Create a stream controler, it can only send data
new PostStream(undefined, writableStream);

//Create a stream controler, it can send and receive data
new PostStream(readableStream, writableStream);
```

### StaticClassProperty

##### `serialize(data: Array): Buffer`
Serilize data. Pass a array, item type can be number, string, boolean, null, undefined, object or buffer.

##### `parse(data: Buffer): Array`
Parse data. Pass a serialized data.

### ClassProperty

##### `data: EventEmiter`
This is a `EventEmiter`. Received data`s title is event name.

```javascript
const ps = new PostStream(readableStream, writableStream);
ps.data.once('test', function(data){ });
await ps.send('test', 123);
```

##### `parseData: boolean`
Parse received data. Default is true. If you set false,
 then you need use `PostStream.parse` to parse  every received data.

```javascript
const ps = new PostStream(readableStream, writableStream);
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
const ps = new PostStream(readableStream, writableStream);
await ps.send('test');
await ps.send('test1', 123);
await ps.send('test2', 'string', 1, 3.5, true, null, undefined, { name: 'test' }, [1,2,3], Buffer.from('ttt'));
```



##### `send(title: string, data: stream.Readable | stream.Duplex): Promise<void>;`

Send a stream`s data to stream. You can only pass one stream as first argument. Other arguments will be ignore. Receiver side will receive a buffer, data comes from the send stream. This function will return a promise object.

```javascript
const ps = new PostStream(readableStream, writableStream);
await ps.send('stream', fs.createReadStream('./testFile.txt'));
await ps.send('stream', fs.createReadStream('./testFile2.txt'));
```


##### `sendSerializedData(title: string, data: Buffer): Promise<void>;`

Directly send using `PostStream.serialize` serialized data.

```javascript
const ps = new PostStream(readableStream, writableStream);
await ps.sendSerializedData('original', PostStream.serialize(['hello']));
```


##### close

`close(): Promise<void>`

Close readableStream and writableStream.

```javascript
const ps = new PostStream(readableStream, writableStream);
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

This will be triggered when the be controled readableStream trigger end event.

##### `'close'`

This will be triggered when the be controled readableStream trigger close event.

##### `'error'`

This will be triggered when the be controled readableStream or writableStream trigger error event.

### Attention
If you want to use `pipe` to communicate with child process, you would better use two pipe instead of one.
Because of don\`t know why child send data to parent will lost one data fragment.(this is not this package\`s problem)

```javascript
//parent

const child_process = require('child_process');
const path = require('path');
const PostStream = require('post-stream');
const child = child_process.spawn(process.execPath, [path.resolve('./child.js')], {
    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe']
});
const ps = new PostStream(child.stdio[3], child.stdio[4]);
ps.data.on('main', data => {
    console.log('main:', data)
});
ps.send('child',123);
```
```javascript
//child
const fs = require('fs');
const PostStream = require('post-stream');

let read = fs.createReadStream(null,{fd:4});
let write = fs.createWriteStream(null,{fd:3});
const ps = new PostStream(read, write);
ps.data.on('child', data => {
    ps.send('main', data);
});
```