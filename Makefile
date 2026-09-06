.PHONY: all build test clean run

BINARY_NAME=search

all: test build

build:
	go build -ldflags="-s -w" -o bin/$(BINARY_NAME) ./cmd/search

test:
	go test -v -race ./...

run: build
	./bin/$(BINARY_NAME)

clean:
	rm -rf bin/
