'use strict';

const state = {
  type: i32(),
  method: i32()
};

const settings = {
  on_message_begin: notify(),
  on_url: data('url')
};

const HTTP_REQUEST = 1;
const HTTP_RESPONSE = 2;

const INVALID_METHOD = 1;
const INVALID_URL_CHARACTER = 2;

const init = () => {
  '@default';

  switch (_) {
    default:
      redirect(start_req_or_res);
      break;
  }
};

const start_req_or_res = () => {
  switch (_) {
    case [ 0x0a, 0x0d ]:
      break;

    case {
      'GET': 1,
      'HEAD': 2,
      'POST': 3,
      'PUT': 4
    }:
      '@notify-on-start(on_message_begin)';

      state.type = HTTP_REQUEST;
      state.method = match();
      next(request_after_method);
      break;

    case 'HTTP':
      '@notify-on-start(on_message_begin)';

      state.type = HTTP_RESPONSE;
      next(response_slash);
      break;

    default:
      '@unlikely';

      error(INVALID_METHOD, 'Unknown method');
      break;
  }
};

const request_after_method = () => {
  switch (_) {
    case ' ':
      break;

    case 0x0:
      '@unlikely';

      error(INVALID_METHOD, '`\\0` after method');
      break;

    default:
//      settings.on_url.start();
      redirect(url);
      break;
  }
};

const url = () => {
  switch (_) {
    case ' ':
      next(req_http_start);
//      settings.on_url.end();
      break;

    case [ '\r', '\n' ]:
      '@unlikely';

      error(INVALID_URL_CHARACTER,
            'URL can\'t have newline chars in it');
      break;

    case [ '\t', '\f' ]:
      '@ifdef(strict)';
      '@unlikely';

      error(INVALID_URL_CHARACTER,
            'URL can\'t have "\\t" or "\\f" chars in it');
      break;
  }
};

const req_http_start = () => {
  switch (_) {
    default:
      break;
  }
};

const response_slash = () => {
  switch (_) {
    default:
      break;
  }
};

const rec1 = () => {
  switch (_) {
    default:
      next(rec2);
      break;
  }
};

const rec2 = () => {
  switch (_) {
    default:
      next(rec1);
      break;
  }
};
