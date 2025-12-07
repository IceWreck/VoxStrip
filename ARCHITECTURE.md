# VoxStrip - AI Karaoke System Architecture

## Overview
VoxStrip is an AI-based karaoke system built in Go that processes audio files to separate vocals and instruments, manages a song library with synchronized lyrics, and provides export capabilities for karaoke use.

## Core Components

### 1. API Layer (Connect RPC + Protobuf)
- **Service Definition**: KaraokeService with methods for library management and export
- **Transport**: HTTP/2 with Connect RPC for high-performance API
- **Authentication**: JWT-based auth (future enhancement)

### 2. CLI Client
- **Shared Types**: Reuses Protobuf messages for consistency
- **Commands**: Import, list, export, queue management
- **Configuration**: Server endpoint and auth settings
- **Progress Tracking**: Real-time status for long operations

### 2. Library Management
- **Import Service**: Handles MP3 + LRC file imports with metadata overrides
- **Storage Interface**: Generic repository pattern for database abstraction
- **Metadata Extraction**: Automatic tag reading from audio files

### 3. Audio Processing Pipeline
- **Queue System**: Background job processing for audio separation
- **AudioSplitter Integration**: Wrapper around external CLI tool
- **File Management**: Storage of original, vocal, and instrumental tracks

### 4. Export Engine
- **Audio Mixing**: Dynamic vocal/instrumental balance adjustment
- **Format Support**: MP3 export (current), MP4 export (future)
- **Quality Control**: Configurable bitrate and sample rate

## Data Models

### Song
```go
type Song struct {
    ID           string
    Title        string
    Artist       string
    Album        string
    Duration     time.Duration
    OriginalFile string
    VocalFile    string
    InstrumentalFile string
    LyricsFile   string
    AlbumArt     string
    Status       ProcessingStatus
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
```

### Processing Status
- `pending` - Queued for processing
- `processing` - Audio separation in progress
- `completed` - Ready for use
- `failed` - Processing error

## API Endpoints

### Library Management
- `ImportSong(stream ImportSongRequest) returns (ImportSongResponse)`
- `GetSong(GetSongRequest) returns (GetSongResponse)`
- `ListSongs(ListSongsRequest) returns (ListSongsResponse)`
- `DeleteSong(DeleteSongRequest) returns (DeleteSongResponse)`

### Export
- `ExportAudio(ExportAudioRequest) returns (stream ExportAudioResponse)`
- `ExportVideo(ExportVideoRequest) returns (stream ExportVideoResponse)` // Future

### Queue Management
- `GetQueueStatus(GetQueueStatusRequest) returns (GetQueueStatusResponse)`

## Storage Interface

```go
type SongRepository interface {
    Create(ctx context.Context, song *Song) error
    Get(ctx context.Context, id string) (*Song, error)
    List(ctx context.Context, filter SongFilter) ([]*Song, error)
    Update(ctx context.Context, song *Song) error
    Delete(ctx context.Context, id string) error
}
```

## Directory Structure

```
voxstrip/
├── api/
│   └── v1/
│       ├── connect/
│       │   └── karaoke.connect.go
│       └── karaoke.v1.proto
├── cmd/
│   ├── server/
│   │   └── main.go
│   └── cli/
│       └── main.go
├── pkg/
│   ├── audio/
│   │   ├── processor.go
│   │   └── mixer.go
│   ├── config/
│   │   └── config.go
│   ├── library/
│   │   ├── importer.go
│   │   └── service.go
│   ├── models/
│   │   └── song.go
│   ├── queue/
│   │   ├── processor.go
│   │   └── worker.go
│   ├── repository/
│   │   ├── memory.go
│   │   └── postgres.go
│   └── storage/
│       └── filesystem.go
├── scripts/
│   └── audio-splitter.sh
├── uploads/
├── processed/
└── exports/
```

## Technology Stack

### Core
- **Language**: Go 1.21+
- **RPC**: Connect RPC + Protocol Buffers
- **CLI**: urfave/cli/v3 for command-line interface
- **Config**: caarlos0/env/v11 for environment-based configuration
- **Queue**: In-memory queue (can be replaced with Redis)
- **Storage**: Filesystem + Repository pattern

### External Dependencies
- **AudioSplitter CLI**: External tool for vocal/instrumental separation
- **Taglib**: Go bindings for audio metadata extraction
- **FFmpeg**: Audio processing and export

### Future Enhancements
- **Database**: PostgreSQL with GORM
- **Cache**: Redis for session management
- **Message Queue**: RabbitMQ/Apache Kafka for distributed processing
- **Object Storage**: S3-compatible storage for audio files

## Processing Flow

1. **Import**: Client uploads MP3 + LRC via streaming RPC
2. **Validation**: File format verification and metadata extraction
3. **Queue**: Song added to processing queue
4. **Audio Separation**: Worker calls AudioSplitter CLI
5. **Storage**: Results stored in filesystem with metadata
6. **Export**: Dynamic mixing based on client preferences

## Configuration

Simple environment-based configuration struct:

```go
// pkg/config/config.go
type Config struct {
    Server struct {
        Port    string `env:"PORT" envDefault:"8080"`
        Host    string `env:"HOST" envDefault:"0.0.0.0"`
    }
    
    Storage struct {
        UploadDir     string `env:"UPLOAD_DIR" envDefault:"./uploads"`
        ProcessedDir  string `env:"PROCESSED_DIR" envDefault:"./processed"`
        ExportDir     string `env:"EXPORT_DIR" envDefault:"./exports"`
    }
    
    Audio struct {
        SplitterCommand        string  `env:"SPLITTER_COMMAND" envDefault:"./scripts/audio-splitter.sh"`
        DefaultVocalReduction  float64 `env:"DEFAULT_VOCAL_REDUCTION" envDefault:"0.7"`
        DefaultInstrumentalBoost float64 `env:"DEFAULT_INSTRUMENTAL_BOOST" envDefault:"1.3"`
    }
    
    Queue struct {
        MaxWorkers    int           `env:"MAX_WORKERS" envDefault:"4"`
        WorkerTimeout time.Duration `env:"WORKER_TIMEOUT" envDefault:"10m"`
    }
}
```

Using `github.com/caarlos0/env/v11` for environment parsing.

### CLI Configuration
CLI uses `urfave/cli/v3` for command parsing with shared Protobuf types:

```bash
# CLI Commands
voxstrip import --audio song.mp3 --lyrics song.lrc --artist "Artist" --title "Title"
voxstrip list --status completed
voxstrip export --song-id xyz --output karaoke.mp3 --vocal-reduction 0.5
voxstrip queue status
```

## Security Considerations

- File upload size limits
- Input validation for audio formats
- Secure file path handling
- Rate limiting on API endpoints
- Sanitization of metadata inputs

## Performance Optimizations

- Streaming for large file transfers
- Concurrent audio processing workers
- Lazy loading of audio data
- Caching of frequently accessed songs
- Connection pooling for database operations

## Development Phases

### Phase 1: Core Infrastructure
- [ ] Set up Go project structure
- [ ] Define Protobuf service
- [ ] Implement basic Connect RPC server
- [ ] Create in-memory repository
- [ ] Basic file upload/download

### Phase 2: Audio Processing
- [ ] Implement queue system
- [ ] AudioSplitter CLI integration
- [ ] File management and storage
- [ ] Basic audio mixing for export

### Phase 3: Library Management
- [ ] Metadata extraction from audio files
- [ ] LRC lyrics parsing and synchronization
- [ ] Song listing and search functionality
- [ ] Album art handling

### Phase 4: Production Readiness
- [ ] PostgreSQL repository implementation
- [ ] Configuration management
- [ ] Error handling and logging
- [ ] Basic tests and documentation

## Next Steps

1. Initialize Go module and project structure
2. Define the Protobuf service contract
3. Implement basic Connect RPC server
4. Create the storage interface and in-memory implementation
5. Set up the audio processing queue
6. Integrate with external AudioSplitter CLI
7. Implement the export functionality with audio mixing
