import { LLParse } from '../../src/api';

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
  .match(' HTTP/1.1\n\n', complete)
  .otherwise(p.error(6, 'Expected HTTP/1.1 and two newlines'));

// Build

const fs = require('fs');
const path = require('path');

const artifacts = p.build(method);
fs.writeFileSync(path.join(__dirname, 'http_parser.h'), artifacts.header);
fs.writeFileSync(path.join(__dirname, 'http_parser.c'), artifacts.c);
