#include "fixture.h"

int llparse__print_zero(llparse_state_t* s, const char* p, const char* endp) {
  llparse__print(p, endp, "0");
  return 0;
}


int llparse__print_one(llparse_state_t* s, const char* p, const char* endp) {
  llparse__print(p, endp, "1");
  return 0;
}


int llparse__print_off(llparse_state_t* s, const char* p, const char* endp) {
  llparse__print(p, endp, "");
  return 0;
}


int llparse__print_match(llparse_state_t* s, const char* p, const char* endp,
                         int value) {
  llparse__print(p, endp, "match=%d", value);
  return 0;
}


int llparse__on_dot(llparse_state_t* s, const char* p, const char* endp) {
  return llparse__print_span("dot", p, endp);
}


int llparse__on_dash(llparse_state_t* s, const char* p, const char* endp) {
  return llparse__print_span("dash", p, endp);
}


int llparse__on_underscore(llparse_state_t* s, const char* p,
                           const char* endp) {
  return llparse__print_span("underscore", p, endp);
}
