# Backend TODO

Deferred backend improvements identified during the 2026-09 UI rewrite. The
small items from that review (GET media endpoints with Range support, the
`UpdateSong` RPC, the CORS credentials-with-wildcard fix, and the download
filename extension fix) are already done.

## Features

- **Lyrics auto-fetch** — look up synced (LRC) lyrics from LRCLIB (or
  similar) by title/artist/duration at import time or on demand, instead of
  relying on lyrics embedded in file tags. Store fetched lyrics via the
  existing `UpdateSong` path. This is the highest-impact item: most files
  have no embedded LRC lyrics, and synced lyrics are the core karaoke
  experience.
- **Server-side search** — `ListSongs` only filters by processing status;
  text search happens client-side after downloading the full library. Fine at
  ≤4k songs, needed if the library grows past that. Add a `query` field to
  `ListSongsRequest` (SQLite `LIKE` or FTS5).
- **Processing status push** — the UI polls every 3s while songs are
  PENDING/PROCESSING. A ConnectRPC server stream or SSE endpoint for status
  changes would remove the polling.
- **On-the-fly transcoding** — `DownloadAudioRequest` accepts
  `output_format`, `bitrate`, `vocal_reduction`, and `instrumental_boost`,
  but all are ignored; stems are baked as MP3@192k at processing time. Either
  implement them (ffmpeg on demand) or remove the fields from the proto to
  stop advertising capabilities that don't exist.

## Operational

- **Embed `ui/dist` in the binary** — the server reads `ui/dist` from the
  working directory at runtime (`pkg/api/server.go`), so the binary only
  works when started from the right CWD. Use `go:embed` (like the SQLite
  migrations) or make the path configurable.
- **GET-enable read RPCs** — mark `ListSongs`/`GetSong` with
  `idempotency_level = NO_SIDE_EFFECTS` so ConnectRPC serves them over HTTP
  GET, making them cacheable and curl-friendly.
- **HTTP request logging** — the logging interceptor only covers RPCs; the
  plain HTTP routes (`/health`, `/media/...`, static UI) are unlogged. Add a
  small HTTP logging middleware if visibility is wanted.
- **Auth at the app layer** — there is no authentication in the Go server;
  it relies entirely on an external reverse proxy. Fine for a homelab, but
  worth revisiting if it's ever exposed more widely.
