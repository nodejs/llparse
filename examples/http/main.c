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
  int index;
  void* data;

  unsigned int method : 8;
  const char* url_start;
};

void http_parser_init(http_parser_state_t* s);
int http_parser_execute(http_parser_state_t* s, const char* p,
                        const char* endp);

static void on_url_part(http_parser_state_t* s, const char* p,
                        const char* endp) {
  if (p == endp)
    return;

  fprintf(stdout, "method=%d url_part=\"%.*s\"\n", s->method,
          (int) (endp - p), p);
}


int on_url_start(http_parser_state_t* s, const char* p, const char* endp) {
  s->url_start = p;
  return 0;
}


int on_url_end(http_parser_state_t* s, const char* p, const char* endp) {
  on_url_part(s, s->url_start, p - 1);
  fprintf(stdout, "url end\n");
  s->url_start = NULL;
  return 0;
}


int on_complete(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_complete\n");
  return 0;
}


int main(int argc, char** argv) {
  http_parser_state_t s;

  http_parser_init(&s);

  s.url_start = NULL;

  for (;;) {
    char buf[16384];
    const char* input;
    const char* endp;
    int code;

    input = fgets(buf, sizeof(buf), stdin);
    if (input == NULL)
      break;

    if (s.url_start != NULL)
      s.url_start = input;

    endp = input + strlen(input);
    code = http_parser_execute(&s, input, endp);
    if (code != 0) {
      fprintf(stderr, "code=%d error=%d reason=%s\n", code, s.error, s.reason);
      return -1;
    }

    if (s.url_start != NULL)
      on_url_part(&s, s.url_start, endp);
  }

  return 0;
}
