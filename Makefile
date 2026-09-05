#!make
-include .env
export $(shell sed 's/=.*//' .env)
SHELL := /bin/bash

.PHONY: *

run:
	go run ./cmd

build: ui-build
	go build -v -o ./bin/voxstrip ./cmd

# touch restores the placeholder go:embed needs; vite's emptyOutDir wipes it.
ui-build:
	cd ui/voxstrip && npm install && npm run build
	touch pkg/webui/dist/.gitkeep

buf-gen:
	buf generate

fmt:
	go fmt ./...
	goimports -w .

vet:
	go vet ./...

clean:
	rm -rf ./bin
	find ./pkg/webui/dist -mindepth 1 ! -name .gitkeep -delete

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
