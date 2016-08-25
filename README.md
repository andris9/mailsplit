# mailsplit

Split an email message stream into parts and join these parts back into an email message. If you do not modifying anything then the rebuilt message should be an exact copy of the original.

This is useful if you want to modify some specific parts of an email, for example to add tracking images or unsubscribe links to the HTML part of the message without changing any other parts of the email.

This module is a primitive for building other e-mail handling stuff.

Supports both &lt;CR&gt;&lt;LF&gt; and &lt;LF&gt; (even mixed) line endings. Embedded rfc822 messages are also parsed, in this case you would get two sequential 'node' objects with no 'data' or 'body' in  between, first is for the container node and second for the root node of the embedded message.

## Usage

### Split message stream

`Splitter` is a transformable stream where input is a byte stream and output is an object stream.

```javascript
let Splitter = require('mailsplit').Splitter;
let splitter = new Splitter();
// handle parsed data
splitter.on('data', (data)=>{
    switch(data.type){
        case 'node':
            // node header block
            process.stdout.write(data.getHeaders());
            break;
        case 'data':
            // multipart message structure
            // this is not related to any specific 'node' block as it includes
            // everything between the end of some node body and between the next header
            process.stdout.write(data.value)
            break;
        case 'body':
            // Leaf element body. Includes the body for the last 'node' block. You might
            // have several 'body' calls for a single 'node' block
            process.stdout.write(data.value)
            break;
    }
});
// send data to the parser
someMessagStream.pipe(splitter);
```

### Join parsed message stream

`Joiner` is a transformable stream where input is the object stream form `Splitter` and output is a byte stream

```javascript
let Splitter = require('mailsplit').Splitter;
let Joiner = require('mailsplit').Joiner;
let splitter = new Splitter();
let joiner = new Joiner();
// pipe a message source to splitter, then joiner and finally to stdout
someMessagStream.pipe(splitter).pipe(joiner).pipe(process.stdout);
```

### Benchmark

Parsing and re-building messages is not fast but it isn't slow either. On my Macbook Pro I got around 22 MB/second (single process, single parsing queue) when parsing random messages from my own email archive. Time spent includes file calls to find and load random messages from disk.

```
Streaming 20000 random messages through a plain PassThrough
Done. 20000 messages [1244 MB] processed in 10.095 s. with average of 1981 messages/sec [123 MB/s]
Streaming 20000 random messages through Splitter and Joiner
Done. 20000 messages [1244 MB] processed in 55.882 s. with average of 358 messages/sec [22 MB/s]
```

## License

**MIT**
