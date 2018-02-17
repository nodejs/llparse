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
  int match;
};

/* 2 gb */
static const int64_t kBytes = 2147483648LL;

static int bench = 0;
static const char* start;

void llparse_init(struct state* s);
int llparse_execute(struct state* s, const char* p, const char* endp);

int print_match(struct state* s, const char* p, const char* endp) {
  if (bench)
    return 0;

  fprintf(stdout, "off=%d match=%d\n", (int) (p - start), s->match);
  return 0;
}

int return_match(struct state* s, const char* p, const char* endp) {
  if (bench)
    return s->match;

  fprintf(stdout, "off=%d return match=%d\n", (int) (p - start), s->match);
  return s->match;
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
