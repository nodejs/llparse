CC ?= clang

all: http

http: main.c http_parser.bc
	$(CC) -g3 -flto -Os -fvisibility=hidden -Wall -I. http_parser.c main.c -o $@

http_parser.bc: index.ts
	npx ts-node $<

.PHONY = all
