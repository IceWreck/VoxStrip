# BASE_IMAGE and TORCH_INDEX select the variant: the defaults build the
# CPU-only image; pass the CUDA base image and wheel index for the NVIDIA one
# (see the container-build-gpu Makefile target).
ARG BASE_IMAGE=docker.io/ubuntu:22.04

FROM docker.io/node:22-alpine AS frontend-builder

ARG VITE_API_BASE_URL=""

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app/ui

COPY ui/voxstrip/package*.json ./
RUN npm ci

COPY ui/voxstrip/ ./
RUN npm run build

FROM docker.io/golang:1.24-alpine AS backend-builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -v -o ./bin/voxstrip ./cmd

FROM ${BASE_IMAGE}

ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu

ENV DEBIAN_FRONTEND=noninteractive \
    TORCH_HOME=/data/models \
    OMP_NUM_THREADS=1 \
    DEMUCS_COMMAND="python3 -m demucs"

RUN apt update && apt install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    ffmpeg \
    git \
    python3 \
    python3-pip \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Torch is installed first from the variant's wheel index so demucs (which
# depends on torch) doesn't pull the CUDA-bundled PyPI build into the CPU
# image. numpy is listed explicitly because demucs 4.1.0 needs it at runtime
# but omits it from its Linux dependency metadata.
RUN python3 -m pip install "torch==2.4.0" --index-url "${TORCH_INDEX}" --no-cache-dir && \
    python3 -m pip install "demucs==4.1.0" numpy --no-cache-dir

# Trigger demucs model download by running it on a test audio file
# This ensures models are cached in TORCH_HOME before the container starts
RUN mkdir -p /data/models && \
    ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -q:a 9 -acodec libmp3lame /tmp/test.mp3 && \
    python3 -m demucs -n htdemucs -d cpu /tmp/test.mp3 && \
    rm -rf /tmp/test.mp3 separated

RUN groupadd -r voxstrip -g 1000 && \
    useradd -r -u 1000 -g voxstrip -d /app -s /sbin/nologin voxstrip && \
    chown -R voxstrip:voxstrip /data/models

WORKDIR /app

COPY --from=backend-builder /app/bin/voxstrip /app/voxstrip
COPY --from=frontend-builder /app/ui/dist /app/ui/dist

RUN chown -R voxstrip:voxstrip /app

USER voxstrip

ENV PORT=8080 \
    HOST=0.0.0.0 \
    DB_PATH=/app/data/voxstrip.db \
    BLOBSTORE_DIR=/app/data/blobs \
    AUDIO_TEMP_DIR=/app/temp \
    DEMUCS_MODEL="htdemucs"

EXPOSE 8080

CMD ["/app/voxstrip"]
