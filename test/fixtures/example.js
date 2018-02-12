'use strict';

const state = {
  type: i32(),
  method: i32()
};

const settings = {
  on_message_begin: notify(),
  on_url: data('url')
};

const METHODS = {
  'GET': 1,
  'HEAD': 2,
  'POST': 3,
  'PUT': 4
};

const HTTP_REQUEST = 1;
const HTTP_RESPONSE = 2;

const INVALID_METHOD = 1;
const INVALID_URL_CHARACTER = 2;

const init = () => {
  '@default';

  switch (_) {
    default:
      rerun(start_req_or_res);
      break;
  }
};

const start_req_or_res = () => {
  switch (_) {
    case [ 0x0a, 0x0d ]:
      skip();
      break;

    '@notify-on-start(on_message_begin)';
    case METHODS:
      state.type = HTTP_REQUEST;
      state.method = match();
      next(request_after_method);
      break;

    '@notify-on-start(on_message_begin)';
    case 'HTTP':
      state.type = HTTP_RESPONSE;
      next(response_slash);
      break;

    '@unlikely';
    default:
      error(INVALID_METHOD, 'Unknown method');
      break;
  }
};

const request_after_method = () => {
  switch (_) {
    case ' ':
      skip();
      break;

    '@unlikely';
    case 0x0:
      error(INVALID_METHOD, '`\0` after method');
      break;

    default:
      settings.on_url.start();
      rerun(url);
      break;
  }
};

const url = () => {
  switch (_) {
    case ' ':
      next(req_http_start);
      settings.on_url.end();
      break;

    '@unlikely';
    case [ '\r', '\n' ]:
      error(INVALID_URL_CHARACTER,
            'URL can\'t have newline chars in it');
      break;

    '@unlikely';
    '@mode(strict)';
    case [ '\t', '\f' ]:
      error(INVALID_URL_CHARACTER,
            'URL can\'t have "\\t" or "\\f" chars in it');
      break;
  }
};

const response_slash = () => {
  switch (_) {
  }
};
