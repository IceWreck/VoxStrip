# Agents Knowledge

VoxStrip is an AI-based karaoke system built in Go that processes audio files to separate vocals and instruments, manages a song library with synchronized lyrics, and provides export capabilities for karaoke use.

## Architecture

@ARCHITECTURE.md

## Coding Conventions

- Use the stdlib's slog package for logging.
- The log message should always start with lowercase and should not end with a period. Example: `slog.Info("info message")`
- Use early returns to reduce indentation.
- Extract complex logic into functions.
- Leverage data structures instead of deeply nested conditions.
- Write self-explanatory code – Prefer clear variable and function names over comments.
- Explain "why," not "what" – Comments should clarify intent, not restate code.
- Avoid redundant comments – Don't comment obvious things.
- Use comments for complex logic – Explain non-trivial decisions or workarounds.

## Formatting, Linting & Building

After significant code changes, format, lint and vet with:

```
make check
```

Build with:

```
make build
```

Regenerate protbuf with

```
make buf-gen
```
