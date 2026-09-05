#!make
-include .env
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

ui-dev:
	cd ui/voxstrip && VITE_API_BASE_URL="http://localhost:8080" npm run dev

container-build:
	podman build -t voxstrip .

container-build-gpu:
	podman build \
		--build-arg BASE_IMAGE=docker.io/nvidia/cuda:12.4.0-base-ubuntu22.04 \
		--build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu124 \
		-t voxstrip:nvidia .

container-run:
	podman run -ti --rm -p 8080:8080 -v voxstrip-data:/app/data voxstrip

container-run-gpu:
	podman run -ti --rm --device nvidia.com/gpu=all --security-opt label=disable -p 8080:8080 -v voxstrip-data:/app/data voxstrip:nvidia
