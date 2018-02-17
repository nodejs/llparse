'use strict';

const p = require('../../').create('http_parser');

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
  .otherwise(p.skip());

http
  .match('HTTP/1.1\r\n\r\n', complete)
  // Just for console testing
  .match('HTTP/1.1\n\n', complete)
  .otherwise(p.error(6, 'Expected HTTP/1.1 and two newlines'));

console.log(p.build(method));
