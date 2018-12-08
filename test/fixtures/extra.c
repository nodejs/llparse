#include "fixture.h"

int llparse__print_zero(llparse_t* s, const char* p, const char* endp) {
  if (llparse__in_bench)
    return 0;
  llparse__print(p, endp, "0");
  return 0;
}


int llparse__print_one(llparse_t* s, const char* p, const char* endp) {
  if (llparse__in_bench)
    return 0;
  llparse__print(p, endp, "1");
  return 0;
}


int llparse__print_off(llparse_t* s, const char* p, const char* endp) {
  if (llparse__in_bench)
    return 0;
  llparse__print(p, endp, "");
  return 0;
}


int llparse__print_match(llparse_t* s, const char* p, const char* endp,
                         int value) {
  if (llparse__in_bench)
    return 0;
  llparse__print(p, endp, "match=%d", value);
  return 0;
}


int llparse__on_dot(llparse_t* s, const char* p, const char* endp) {
  if (llparse__in_bench)
    return 0;
  return llparse__print_span("dot", p, endp);
}


int llparse__on_dash(llparse_t* s, const char* p, const char* endp) {
  if (llparse__in_bench)
    return 0;
  return llparse__print_span("dash", p, endp);
}


int llparse__on_underscore(llparse_t* s, const char* p,
                           const char* endp) {
  if (llparse__in_bench)
    return 0;
  return llparse__print_span("underscore", p, endp);
}


/* A span callback, really */
int llparse__please_fail(llparse_t* s, const char* p, const char* endp) {
  s->reason = "please fail";
  if (llparse__in_bench)
    return 1;
  return 1;
}


/* A span callback, really */
static int llparse__pause_once_counter;

int llparse__pause_once(llparse_t* s, const char* p, const char* endp) {
  if (!llparse__in_bench)
    llparse__print_span("pause", p, endp);

  if (llparse__pause_once_counter != 0)
    return 0;
  llparse__pause_once_counter = 1;

  return LLPARSE__ERROR_PAUSE;
}


int llparse__test_init() {
  llparse__pause_once_counter = 0;
}
