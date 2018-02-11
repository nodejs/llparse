# Design

```js
const state = {
  type: i32()
};

const settings = {
  message_begin: notify()
};

const HTTP_REQUEST = 1;
const HTTP_RESPONSE = 2;

start_req_or_res = (c) => {
  switch (c) {
    (0x0a, 0x0d):
      skip();

    'H':
      next = res_or_resp_H;
      settings.message_begin();

    default:
      state.type = HTTP_REQUEST;
      goto start_req;
  }
}

res_or_resp_H = (c) => {
  switch (c) {
    'T':
      state.type = HTTP_RESPONSE;
      next = s_res_HT;
  }
};
```
