#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/time.h>

/* Please don't use -flto, it breaks my heart... and benchmarks */
uint8_t llparse__bench_switch(const char* p, const char* endp);
uint8_t llparse__bench_bitmap(const char* p, const char* endp);

/* 8 gb */
static const int64_t kBytes = 8589934592LL;


static void bench(int llvm, const char* input) {
  const char* endp;
  int len;

  struct timeval start;
  struct timeval end;
  double bw;
  double time;
  int64_t i;
  int64_t iterations;

  len = strlen(input);
  endp = input + len;
  iterations = kBytes / (int64_t) len;

  gettimeofday(&start, NULL);
  if (llvm) {
    for (i = 0; i < iterations; i++)
      llparse__bench_switch(input, endp);
  } else {
    for (i = 0; i < iterations; i++)
      llparse__bench_bitmap(input, endp);
  }

  gettimeofday(&end, NULL);

  time = (end.tv_sec - start.tv_sec);
  time += (double) (end.tv_usec - start.tv_usec) * 1e-6;
  bw = (double) kBytes / time;

  fprintf(stdout, "%s: %.2f mb | %.2f mb/s | %.2f s\n",
      llvm ? "switch" : "bitmap",
      (double) kBytes / (1024 * 1024),
      bw / (1024 * 1024),
      time);
}


int main(int argc, const char** argv) {
  if (argc < 2)
    return -1;

  bench(0, argv[1]);
  bench(1, argv[1]);
  return 0;
}
