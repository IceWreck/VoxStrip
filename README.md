# VoxStrip

VoxStrip is an AI-based karaoke system built in Go. It separates uploaded songs
into vocal and instrumental stems (via [demucs](https://github.com/facebookresearch/demucs)),
manages a song library with synchronized lyrics, and plays them back in a web UI
with a live vocal-guide blend fader and a fullscreen stage display for a TV or
projector.

## Usage

```sh
make build          # build ./bin/voxstrip
make run            # run the server (API + UI on :8080)
make ui-dev         # frontend dev server on :5173, pointed at :8080
make check          # gofmt + goimports + go vet
make buf-gen        # regenerate protobuf (Go + TypeScript)
```

The server serves the built UI from `ui/dist` in its working directory. Audio
processing shells out to demucs; the default command (`uv run demucs`) uses the
`pyproject.toml` in this repo, so a working [uv](https://docs.astral.sh/uv/)
install is all you need. A GPU speeds up separation considerably.

Or run it as a container:

```sh
make container-build
make container-run       # CPU
make container-run-gpu   # NVIDIA GPU (CDI)
```

## Configuration

All configuration is via environment variables (a `.env` file in the repo root
is loaded by the Makefile). Defaults suit local use.

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listen address |
| `PORT` | `8080` | Listen port |
| `CORS_ALLOWED_ORIGINS` | _(empty)_ | Comma-separated origins allowed to call the API cross-origin, with credentials. Localhost origins are always allowed. Not needed when the UI is served by this server (same origin). |
| `DB_PATH` | `./data/voxstrip.db` | SQLite database path |
| `BLOBSTORE_DIR` | `./data/blobs` | Audio and cover art storage |
| `AUDIO_WORKER_COUNT` | `2` | Concurrent processing workers |
| `AUDIO_POLL_INTERVAL` | `5s` | How often workers look for pending songs |
| `AUDIO_PROCESSING_TIMEOUT` | `20m` | Per-song processing time limit |
| `DEMUCS_COMMAND` | `uv run demucs` | Command used to run demucs |
| `DEMUCS_MODEL` | `htdemucs` | Demucs model name |
| `AUDIO_TEMP_DIR` | `./temp` | Scratch space during processing |

The frontend build takes `VITE_API_BASE_URL` (baked in at build time, see the
Dockerfile); leave it unset when the Go server serves the UI.

There is no built-in authentication — put a reverse proxy with basic auth in
front if you expose it beyond your LAN, and list the public origin in
`CORS_ALLOWED_ORIGINS` if the UI is hosted on a different origin than the API.
