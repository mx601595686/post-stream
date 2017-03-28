# post-stream
Send number, string, boolean, null, undefined, object, buffer and stream to a stream efficiently and conveniently.

---
## API

### Constructor

```javascript
//Create a stream controler, it can only receive data
new PostStream(readableStream);

//Create a stream controler, it can only send data
new PostStream(writableStream);

//Create a stream controler, it can send and receive data
new PostStream(duplexStream);
new PostStream(readableStream, writableStream);
```

### send

`send(title: string, ...data: any[]): Promise<void>`

Send number, string, boolean, null, undefined, object, buffer to stream. 
The first argument must be a string, it is used for description the data. After that you can pass zero or more data as arguments. If a argument is object or array，it will be serialized( use JSON.stringify ). If you want send a buffer, don`t put it in object or array. This function will return a promise object.
```javascript
const ps = new PostStream(readableStream, writableStream);
await ps.send('test');
await ps.send('test1', 123);
await ps.send('test2', 'string', 1, 3.5, true, null, undefined, { name: 'test' }, [1,2,3], Buffer.from('ttt'));
```

---

`send(title: string, data: stream.Readable | stream.Duplex): Promise<void>;`

Send a stream`s data to stream. You can only pass one stream as first argument. Other arguments will be ignore. Receiver side will receive a buffer, data comes from the send stream. This function will return a promise object.

```javascript
const ps = new PostStream(readableStream, writableStream);
await ps.send('stream', fs.createReadStream('./testFile.txt'));
await ps.send('stream', fs.createReadStream('./testFile2.txt'));
```

### close

`close(): Promise<void>`

Close readableStream and writableStream.

```javascript
const ps = new PostStream(readableStream, writableStream);
await ps.close();
```

### Event

#### `'data'` 

This will be triggered when PostStream has received data. The first parameter is title, after that will be zero or more data, determined by when sending.

```javascript
const ps = new PostStream(readableStream, writableStream);
ps.on('data', function (title, data1, data2[, ...data3]) { });
```

#### `'end'` 

This will be triggered when the be controled readableStream trigger end event.

#### `'close'` 

This will be triggered when the be controled readableStream trigger close event.

#### `'error'` 

This will be triggered when the be controled readableStream or writableStream trigger error event.

