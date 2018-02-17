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
  int match;
};

void http_parser_init(http_parser_state_t* s);
int http_parser_execute(http_parser_state_t* s, const char* p,
                        const char* endp);

int on_method(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_method=%d\n", s->match);
  return 0;
}


int on_url_start(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_url_start p=%s\n", p);
  return 0;
}


int on_url_end(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_url_end p=%s\n", p);
  return 0;
}


int on_complete(http_parser_state_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_url_complete\n");
  return 0;
}


int main(int argc, char** argv) {
  http_parser_state_t s;

  http_parser_init(&s);

  for (;;) {
    char buf[16384];
    char* input;
    int code;

    input = fgets(buf, sizeof(buf), stdin);
    if (input == NULL)
      break;

    code = http_parser_execute(&s, input, input + strlen(input));
    if (code != 0) {
      fprintf(stderr, "code=%d error=%d reason=%s\n", code, s.error, s.reason);
      return -1;
    }
  }

  return 0;
}
