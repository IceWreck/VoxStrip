#!make
include .env
export $(shell sed 's/=.*//' .env)
SHELL := /bin/bash

.PHONY: *

run:
	go run ./cmd/server

build:
	go build -v -o ./bin/loghopper-server ./cmd/server
	go build -v -o ./bin/loghopper-proxy ./cmd/proxy

buf_gen:
	buf generate
