#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

#include "http_parser.h"

int on_url(http_parser_t* s, const char* p, const char* endp) {
  if (p == endp)
    return 0;

  fprintf(stdout, "method=%d url_part=\"%.*s\"\n", s->method,
          (int) (endp - p), p);
  return 0;
}


int on_complete(http_parser_t* s, const char* p, const char* endp) {
  fprintf(stdout, "on_complete\n");
  return 0;
}


int main(int argc, char** argv) {
  http_parser_t s;

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
