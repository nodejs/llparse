#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

typedef struct http_parser_state_s http_parser_state_t;

struct http_parser_state_s {
  void* current;
  int error;
  const char* reason;
  uint8_t index;
  void* data;

  uint8_t method;
  void* mark;
};

void http_parser_init(http_parser_state_t* s);
int http_parser_execute(http_parser_state_t* s, const char* p,
                        const char* endp);

int on_url(http_parser_state_t* s, const char* p, const char* endp) {
  if (p == endp)
    return 0;

  fprintf(stdout, "method=%d url_part=\"%.*s\"\n", s->method,
          (int) (endp - p), p);
  return 0;
}


int on_complete(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_complete\n");
  return 0;
}


int main(int argc, char** argv) {
  http_parser_state_t s;

  http_parser_init(&s);

  for (;;) {
    char buf[16384];
    const char* input;
    const char* endp;
    int code;

    input = fgets(buf, sizeof(buf), stdin);
    if (input == NULL)
      break;

    endp = input + strlen(input);
    code = http_parser_execute(&s, input, endp);
    if (code != 0) {
      fprintf(stderr, "code=%d error=%d reason=%s\n", code, s.error, s.reason);
      return -1;
    }
  }

  return 0;
}
