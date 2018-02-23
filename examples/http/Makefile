CC ?= clang

all: http

# NOTE: -flto has a bug, and can't be used right now
# See: https://bugs.llvm.org/show_bug.cgi?id=36441
http: main.c http_parser.ll
	$(CC) -g3 -Os -fvisibility=hidden -Wall -I. http_parser.ll main.c -o $@

http_parser.ll: index.js
	node $<

.PHONY = all
