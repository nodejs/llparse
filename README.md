# llparse
[![Build Status](https://secure.travis-ci.org/nodejs/llparse.svg)](http://travis-ci.org/nodejs/llparse)
[![NPM version](https://badge.fury.io/js/llparse.svg)](https://badge.fury.io/js/llparse)

An API for compiling an incremental parser into a C output.

## Usage

```ts
import { LLParse } from 'llparse';

const p = new LLParse('http_parser');

const method = p.node('method');
const beforeUrl = p.node('before_url');
const urlSpan = p.span(p.code.span('on_url'));
const url = p.node('url');
const http = p.node('http');

// Add custom uint8_t property to the state
p.property('i8', 'method');

// Store method inside a custom property
const onMethod = p.invoke(p.code.store('method'), beforeUrl);

// Invoke custom C function
const complete = p.invoke(p.code.match('on_complete'), {
  // Restart
  0: method
}, p.error(4, '`on_complete` error'));

method
  .select({
    'HEAD': 0, 'GET': 1, 'POST': 2, 'PUT': 3,
    'DELETE': 4, 'OPTIONS': 5, 'CONNECT': 6,
    'TRACE': 7, 'PATCH': 8
  }, onMethod)
  .otherwise(p.error(5, 'Expected method'));

beforeUrl
  .match(' ', beforeUrl)
  .otherwise(urlSpan.start(url));

url
  .peek(' ', urlSpan.end(http))
  .skipTo(url);

http
  .match(' HTTP/1.1\r\n\r\n', complete)
  .otherwise(p.error(6, 'Expected HTTP/1.1 and two newlines'));

const artifacts = p.build(method);
console.log('----- C -----');
console.log(artifacts.c);  // string
console.log('----- C END -----');
console.log('----- HEADER -----');
console.log(artifacts.header);
console.log('----- HEADER END -----');
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2020.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[3]: https://llvm.org/docs/LangRef.html
