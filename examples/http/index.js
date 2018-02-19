'use strict';

const p = require('../../').create('http_parser');

const method = p.node('method');
const beforeUrl = p.node('before_url');
const url = p.node('url');
const http = p.node('http');

// Add custom uint8_t property to the state
p.property(ir => ir.i(8), 'method');

// Store method inside a custom property
const onMethod = p.invoke(p.code.value('on_method', (ir, context) => {
  const body = context.fn.body;
  const trunc = ir._('trunc',
    [ context.match.type, context.match, 'to', ir.i(8) ]);
  body.push(trunc);

  context.store(body, 'method', trunc);
  body.terminate('ret', [ context.ret, context.ret.v(0) ]);
}), {
  // If that function returns zero
  0: beforeUrl
}, p.error(1, '`on_method` error'));

// Invoke external C function
const urlStart = p.invoke(p.code.match('on_url_start'), {
  0: url
}, p.error(2, '`on_url_start` error'));

const urlEnd = p.invoke(p.code.match('on_url_end'), {
  0: http
}, p.error(3, '`on_url_end` error'));

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
  .otherwise(urlStart);

url
  .match(' ', urlEnd)
  .skipTo(url);

http
  .match('HTTP/1.1\r\n\r\n', complete)
  .match('HTTP/1.1\n\n', complete)
  .otherwise(p.error(6, 'Expected HTTP/1.1 and two newlines'));

console.log(p.build(method));
