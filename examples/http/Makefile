CC ?= clang

all: http

# NOTE: -flto has a bug, and can't be used right now
# See: https://bugs.llvm.org/show_bug.cgi?id=36441
http: main.c http.ll
	$(CC) -g3 -Os -fvisibility=hidden -Wall http.ll main.c -o $@

http.ll: index.js
	node $< > $@

.PHONY = all
