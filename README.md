# llparse
[![Build Status](https://secure.travis-ci.org/indutny/llparse.svg)](http://travis-ci.org/indutny/llparse)
[![NPM version](https://badge.fury.io/js/llparse.svg)](https://badge.fury.io/js/llparse)

An API for generating parser in LLVM IR.

## Usage

```js
'use strict';

const p = require('llparse').create('http_parser');

const method = p.node('method');
const beforeUrl = p.node('before_url');
const url = p.node('url');
const http = p.node('http');

// Invoke external C function
const onMethod = p.invoke('on_method', {
  // If that function returns zero
  0: beforeUrl
}, p.error(1, '`on_method` error'));

const urlStart = p.invoke('on_url_start', {
  0: url
}, p.error(2, '`on_url_start` error'));

const urlEnd = p.invoke('on_url_end', {
  0: http
}, p.error(3, '`on_url_end` error'));

const complete = p.invoke('on_complete', {
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
  .otherwise(urlStart);

url
  .match(' ', urlEnd)
  .skipTo(url);

http
  .match('HTTP/1.1\r\n\r\n', complete)
  .otherwise(p.error(6, 'Expected HTTP/1.1 and two newlines'));

console.log(p.build(method));
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2018.

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
