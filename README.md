# mailsplit

Split an email message stream into parts and join these parts back into an email message. If you do not modifying anything then the rebuilt message should be an exact copy of the original.

This is useful if you want to modify some specific parts of an email, for example to add tracking images or unsubscribe links to the HTML part of the message without changing any other parts of the email.

This module is a primitive for building other e-mail handling stuff.

Supports both &lt;CR&gt;&lt;LF&gt; and &lt;LF&gt; (or mixed) line endings. Embedded rfc822 messages are also parsed, in this case you would get two sequential 'node' objects with no 'data' or 'body' in  between (first 'node' is for the container node and second for the root node of the embedded message).

## Data objects

  * **type**
    * `'node'` means that we entered into next mime node and the previous one is now processed
    * `'data'` provides us multipart body parts, including boundaries. This data is not directly related to any specific multipart node, basically it includes everything between the end of one normal node and the header of next node
    * `'body'` provides us next chunk for the last seen `'node'` element
  * **value** is a buffer value for `'body'` and `'data'` parts
  * **header** is an object for manipulating headers (see below)
  * **getHeaders()** is a convenience method for returning all headers (including the terminating empty line) as a single buffer value. If you have modified the headers then these modifications are also included in the output

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

### Manipulating headers

If the data object has `type='node'` then it also has a `headers` object property. This object has several methods for manipulating header values

  * **node.headers.getheaders()** returns a Buffer value with generated headers. If you have not modified the headers object in any way then you should get the exact copy of the original. In case you have done something (for example removed a key, or added a new header key), then all linebreaks are forced to &lt;CR&gt;&lt;LF&gt; even if the original headers used just &lt;LF&gt;
  * **node.headers.getFirst(key)** returns an array of strings with all header rows for the selected key (these are full header lines, so key name is part of the row string)
  * **node.headers.get(key)** returns string value of the specified header key
  * **node.headers.add(key, value [,index])** adds a new header value to the specified index or to the top of the header block if index is not specified
  * **node.headers.update(key, value)** replaces a header value for the specified key
  * **node.headers.delete(key)** remove header value

Additionally you can check the details of the node with the following properties automatically parsed from the headers:

  * **node.contentType** returns the mime type of the node (eg. 'text/html')
  * **node.charset** returns the charset of the node as defined in 'Content-Type' header (eg. 'UTF-8') or false if not defined
  * **node.encoding** returns the Transfer-Encoding value (eg. 'base64' or 'quoted-printable') or false if not defined

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
