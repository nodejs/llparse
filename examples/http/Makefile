CC ?= clang

all: http

http: main.c http.ll
	$(CC) -g3 -Os -flto -fvisibility=hidden -Wall http.ll main.c -o $@

http.ll: index.js
	node $< > $@

.PHONY = all
