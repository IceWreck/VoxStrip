#!make
include .env
export $(shell sed 's/=.*//' .env)
SHELL := /bin/bash

.PHONY: *

run:
	go run ./cmd

build:
	go build -v -o ./bin/voxstrip ./cmd

buf-gen:
	buf generate

fmt:
	go fmt ./...
	goimports -w .

vet:
	go vet ./...

clean:
	rm -rf ./bin

deps:
	go mod download
	go mod tidy

deps-update:
	go get -u ./...
	go mod tidy

tools:
	go install golang.org/x/tools/cmd/goimports@latest

check: fmt vet
