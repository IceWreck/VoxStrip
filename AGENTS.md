# Agents Knowledge

VoxStrip is an AI-based karaoke system built in Go that processes audio files to separate vocals and instruments, manages a song library with synchronized lyrics, and provides export capabilities for karaoke use.

## Architecture

```
VoxStrip (Go-based AI Karaoke System)
├── API Layer (Connect RPC + Protocol Buffers)
│   ├── KaraokeService: ImportSongs, ListSongs, GetSong, DeleteSong
│   ├── Media Operations: DownloadAudio, GetCoverArt
│   └── Audio Versions: Original, Vocal, Instrumental, Karaoke
├── Storage Layer (Repository Pattern)
│   ├── Store Interface: CRUD operations + song claiming
│   ├── Implementations: SQLite (prod), In-memory (dev)
│   └── Song Entity: Metadata + ProcessingStatus + Duration
├── File Management (Blobstore)
│   ├── File Types: Original, Vocal, Instrumental, CoverArt
│   └── Implementation: Filesystem-based storage
├── Audio Processing Pipeline
│   ├── Background Workers (configurable count)
│   ├── Processing States: PENDING → PROCESSING → COMPLETED/FAILED
│   └── External Tools: demucs (vocal separation)
├── UI Layer (React + Skeleton.dev)
│   ├── Generated TypeScript client at ui/voxstrip/src/proto/
│   └── Skeleton.dev based interface at ui/voxstrip/
└── Configuration (Environment-based)
    ├── Server: Host, Port, CORS settings
    ├── Storage: Upload/processed file paths
    └── Audio Processing: Worker count, timeout settings
```

The API layer defines the service contract through Protocol Buffers in `proto/server.proto` and implements the Connect RPC handlers in `pkg/api/service.go`. This layer handles request validation, file uploads, metadata management, and orchestrates interactions between storage and file management components. It exposes high-level operations like song import, library listing with pagination, and audio downloads with version selection.

Besides connectrpc's native protocol ConnectRPC also support curl and and other http clients by creating an HTTP and JSON based API - https://connectrpc.com/docs/curl-and-other-clients

Storage abstraction is implemented through the repository pattern with the core interface in `pkg/store/interface.go`, supporting both SQLite production implementation in `pkg/store/sqlite/` and in-memory development version in `pkg/store/inmemory/`. The Song entity captures metadata, processing status, and timing information while supporting atomic song claiming for background processing through the `ClaimNextPendingSong` method.

File management uses the blobstore pattern defined in `pkg/blobstore/interface.go` with filesystem implementation in `pkg/blobstore/filesystem.go`. It organizes files by type (Original, Vocal, Instrumental, CoverArt) and handles storage, retrieval, and existence checking with proper MIME type detection and path security.

The audio processing pipeline consists of a coordinator in `pkg/processor` that manages configurable worker pools in `pkg/processor/worker.go`. Songs progress through discrete processing states with background workers claiming pending songs, performing vocal separation using external demucs CLI, and updating completion status.

The UI layer is built with React and Skeleton.dev, located at `ui/voxstrip/`. It includes a generated TypeScript client at `ui/voxstrip/src/proto/` that provides type-safe access to the Connect RPC API. This enables seamless communication between the frontend and backend while maintaining consistency across the stack.
We are using Tanstack Router for routing between pages and Tanstack table for displaying a table.

Configuration management in `pkg/config/config.go` uses environment-based settings for server parameters (host, port, CORS), storage paths, and audio processing options (worker count, timeouts). The system validates input sizes, enforces UUID-based song identification, and implements comprehensive error handling throughout all layers.

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
- Write package, type, function, and method comments as full sentences; start with the name being described.
- Avoid premature abstractions; add interfaces or patterns only when they clarify behavior.
- While writing Go, accept interfaces and return types unless there is a clear reason not to do so.

## Formatting, Linting & Building

After significant code changes, format, lint and vet with:

```
make check
```

And for TS,

```
cd ui/voxstrip && npm run lint
```

Build with:

```
make build
```

Regenerate protobuf:

```
make buf-gen
```


## Ticketing System


This project uses a CLI ticket system for task management. Use the following if you ever need to use it.

### Basic Workflow

```bash
uvx git+https://github.com/IceWreck/AgentCohort.git task --help

# Create a task
uvx git+https://github.com/IceWreck/AgentCohort.git task agentcohort task create "Fix login bug" -p 0

# Start working on it
uvx git+https://github.com/IceWreck/AgentCohort.git task agentcohort task start <task_id>

# Close when done
uvx git+https://github.com/IceWreck/AgentCohort.git task agentcohort task close <task_id>
```

### Essential Commands

**Create tasks**
```bash
agentcohort task create "Title" [-d description] [-p priority] [-t type]
# Types: bug, feature, task, epic, chore
# Priority: 0-4 (0=highest)
```

**List & filter**
```bash
agentcohort task ls                    # All tasks
agentcohort task ls --status open     # Filter by status
agentcohort task ready                # Ready to start (no blockers)
agentcohort task blocked              # Blocked by dependencies
agentcohort task closed               # Recently closed
```

**View details**
```bash
agentcohort task show <task_id>       # Full details
agentcohort task edit <task_id>       # Open markdown editor
```

**Task lifecycle**
```bash
agentcohort task start <task_id>      # Mark in_progress
agentcohort task close <task_id>      # Mark closed
agentcohort task reopen <task_id>     # Reopen closed task
agentcohort task status <task_id> <new_status>
```

**Notes**
```bash
agentcohort task add-note <task_id> "Note text"
```

### Dependencies

```bash
# Task B depends on Task A (B blocked until A closes)
agentcohort task dep-add <task_id> <dep_id>

# Remove dependency
agentcohort task dep-remove <task_id> <dep_id>

# View dependency tree
agentcohort task dep-tree <task_id>
```

### Links

```bash
# Create bidirectional links between tasks
agentcohort task link <task_id1> <task_id2>

# Remove link
agentcohort task unlink <task_id> <target_id>
```

### Query (JSON export)

```bash
# Export all tasks as JSON
agentcohort task query

# Filter with jq (requires jq installed)
agentcohort task query '.[] | select(.status == "open")'
agentcohort task query '.[] | .id'
```

### Task IDs

All commands use short task IDs (e.g., `a-864a`). Create a task to get its ID, or use `agentcohort task ls` to see all IDs.
