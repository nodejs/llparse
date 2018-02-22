#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

struct state {
  void* current;
  int error;
  const char* reason;
  int index;
};

/* 8 gb */
static const int64_t kBytes = 8589934592LL;

static int bench = 0;
static const char* start;

void llparse_init(struct state* s);
int llparse_execute(struct state* s, const char* p, const char* endp);

void debug(struct state* s, const char* p, const char* endp, const char* msg) {
  if (bench)
    return;

  fprintf(stderr, "off=%d > %s\n", (int) (p - start), msg);
}

int print_zero(struct state* s, const char* p, const char* endp) {
  if (bench)
    return 0;

  fprintf(stdout, "zero\n");
  return 0;
}

int print_one(struct state* s, const char* p, const char* endp) {
  if (bench)
    return 0;

  fprintf(stdout, "one\n");
  return 0;
}

int print_off(struct state* s, const char* p, const char* endp) {
  if (bench)
    return 0;

  fprintf(stdout, "off=%d\n", (int) (p - start));
  return 0;
}

int print_match(struct state* s, const char* p, const char* endp, int value) {
  if (bench)
    return 0;

  fprintf(stdout, "off=%d match=%d\n", (int) (p - start), value);
  return 0;
}

int return_match(struct state* s, const char* p, const char* endp, int value) {
  if (bench)
    return value;

  fprintf(stdout, "off=%d return match=%d\n", (int) (p - start), value);
  return value;
}

static void print_span(const char* name, const char* p, const char* endp) {
  if (bench)
    return;

  fprintf(stdout, "off=%d len=%d span[%s]=\"%.*s\"\n", (int) (p - start),
          (int) (endp - p), name, (int) (endp - p), p);
}

int on_dot(struct state* s, const char* p, const char* endp) {
  print_span("dot", p, endp);
  return 0;
}

int on_dash(struct state* s, const char* p, const char* endp) {
  print_span("dash", p, endp);
  return 0;
}

int on_underscore(struct state* s, const char* p, const char* endp) {
  print_span("underscore", p, endp);
  return 0;
}

static int run_bench(const char* input, int len) {
  struct state s;
  int64_t i;
  struct timeval start;
  struct timeval end;
  double bw;
  double time;
  int64_t iterations;

  llparse_init(&s);

  iterations = kBytes / (int64_t) len;

  gettimeofday(&start, NULL);
  for (i = 0; i < iterations; i++) {
    int code;

    code = llparse_execute(&s, input, input + len);
    if (code != 0)
      return code;
  }
  gettimeofday(&end, NULL);

  time = (end.tv_sec - start.tv_sec);
  time += (end.tv_usec - start.tv_usec) * 1e-6;
  bw = (double) kBytes / time;

  fprintf(stdout, "%.2f mb | %.2f mb/s | %.2f s\n",
      (double) kBytes / (1024 * 1024),
      bw / (1024 * 1024),
      time);

  return 0;
}


static int run_scan(int scan, const char* input, int len) {
  struct state s;
  llparse_init(&s);

  if (scan <= 0) {
    fprintf(stderr, "Invalid scan value\n");
    return -1;
  }

  while (len > 0) {
    int max;
    int code;

    max = len > scan ? scan : len;

    code = llparse_execute(&s, input, input + max);
    if (code != 0) {
      fprintf(stderr, "code=%d error=%d reason=%s\n", code, s.error, s.reason);
      return -1;
    }

    input += max;
    len -= max;
  }

  return 0;
}


int main(int argc, char** argv) {
  const char* input;
  int len;

  if (argc < 3) {
    fprintf(stderr, "%s [bench or scan-value] [input]\n", argv[0]);
    return -1;
  }

  if (strcmp(argv[1], "bench") == 0)
    bench = 1;

  input = argv[2];
  len = strlen(input);

  if (bench && len == 0) {
    fprintf(stderr, "Input can\'t be empty for benchmark");
    return -1;
  }

  start = input;

  if (bench)
    return run_bench(input, len);
  else
    return run_scan(atoi(argv[1]), input, len);
}
