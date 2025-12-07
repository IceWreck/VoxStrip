# VoxStrip - AI Karaoke System Architecture

## Overview
VoxStrip is an AI-based karaoke system built in Go that processes audio files to separate vocals and instruments, manages a song library with synchronized lyrics, and provides flexible audio download capabilities for karaoke applications.

## Core Components

### 1. API Layer (Connect RPC + Protobuf)
- **Service Definition**: KaraokeService with methods for library management, audio downloads, etc
- **Transport**: HTTP/2 with Connect RPC for high-performance API
- **Authentication**: (future enhancement)

### 2. CLI Client
- **Shared Types**: Reuses Protobuf messages for consistency
- To be decided

### 3. Library Management
- **Import Service**: Handles audio file imports with optional metadata and cover art overrides
- **Storage Interface**: Generic repository pattern for database abstraction
- **Metadata Extraction**: Automatic tag reading from audio files
- **Library as Queue**: Songs progress through processing states within the library itself

### 4. Audio Processing Pipeline
- **Background Processing**: Songs move through discrete processing states
- **demucs Integration**: Wrapper around external CLI tool for vocal/instrumental separation
- **File Management**: Storage of original, vocal, instrumental tracks and cover art
- **State Management**: Processing status tracking with error handling

### 5. Download Engine
- **Multi-Version Support**: Original, vocal-only, instrumental-only, and karaoke mixes
- **Audio Mixing**: Dynamic vocal reduction and instrumental boost for karaoke version
- **Format Support**: MP3 and WAV export formats
- **Direct Downloads**: Binary data transfer without URL management

## Data Models

### Song Entity
- **Identification**: Unique song_id for all operations
- **Metadata**: Title, artist, album, album artist, genre, lyrics (all required)
- **Processing**: Status, error information, and timestamps
- **File References**: Paths to original, vocal, instrumental, and cover art files
- **Duration**: Track length in milliseconds

### Processing Status
- **UNSPECIFIED**: Default/unknown state
- **PENDING**: Just uploaded, awaiting processing
- **PROCESSING**: Audio separation in progress
- **COMPLETED**: Ready for use
- **FAILED**: Processing error occurred

### Audio Versions
- **ORIGINAL**: Uploaded file without modification
- **VOCAL**: Vocals only track
- **INSTRUMENTAL**: Instrumental only track
- **KARAOKE**: Reduced vocals + boosted instrumental mix

## API Design

### Library Management
- **ImportSongs**: Batch import with metadata and cover art overrides
- **ListSongs**: Paginated listing with optional status filtering
- **GetSong**: Retrieve individual song metadata
- **DeleteSong**: Remove song from library

### Media Downloads
- **DownloadAudio**: Get audio in various versions and formats
- **GetCoverArt**: Retrieve cover art image data

### Pagination Strategy
- **Token-based**: Efficient cursor pagination using opaque tokens
- **Stateless**: No server-side pagination state required
- **Consistent**: No duplicate/skipped results during data changes

## Import Flow

1. **Upload**: Client sends audio data with optional metadata and cover art overrides
2. **Validation**: File format verification and metadata extraction
3. **Storage**: Song created with PENDING status in library
4. **Processing**: Background worker separates audio into vocal/instrumental tracks
5. **Completion**: Status updated to COMPLETED or FAILED with error details

## Download Flow

1. **Request**: Client specifies song ID, version, format, and quality settings
2. **Processing**: Server generates requested audio version (if karaoke mix)
3. **Transfer**: Binary audio data sent directly in response
4. **Metadata**: Filename and format information provided

## Storage Architecture

### File Organization
- **Original Files**: Uploaded audio in original format
- **Processed Files**: Separated vocal and instrumental tracks
- **Cover Art**: Extracted or override images
- **Path References**: All file locations stored as string paths

### Repository Pattern
- **Interface**: Generic CRUD operations for song entities
- **Implementations**: In-memory for development, database for production
- **Abstraction**: Easy switching between storage backends

## Configuration Management

### Environment-Based Configuration
- **Server Settings**: Host, port, and network configuration
- **Storage Paths**: Upload, processed, and export directories
- **Audio Processing**: External tool integration and default mixing parameters
- **Queue Settings**: Worker count and timeout configurations

### Audio Processing Defaults
- **Vocal Reduction**: Default level for karaoke mixes
- **Instrumental Boost**: Default enhancement level
- **Quality Settings**: Default bitrate and format options

## Technology Stack

### Core Technologies
- **Language**: Go 1.21+
- **RPC**: Connect RPC + Protocol Buffers
- **CLI**: urfave/cli/v3 for command-line interface
- **Configuration**: caarlos0/env/v11 for environment-based settings

### External Dependencies
- **demucs CLI**: External tool for vocal/instrumental separation
- **Taglib**: Go bindings for audio metadata extraction
- **FFmpeg**: Audio processing and format conversion

### Future Enhancements
- **Database**: PostgreSQL with GORM for persistence
- **Cache**: Redis for session management and performance
- **Message Queue**: RabbitMQ/Apache Kafka for distributed processing
- **Object Storage**: S3-compatible storage for audio files

## Security Considerations

- **File Upload Limits**: Size restrictions and format validation
- **Input Validation**: Comprehensive checking of all inputs
- **Path Security**: Secure file path handling to prevent directory traversal
- **Rate Limiting**: API endpoint protection against abuse
- **Metadata Sanitization**: Input cleaning for metadata fields

## Performance Optimizations

- **Streaming**: Large file transfers using streaming protocols
- **Concurrent Processing**: Multiple workers for audio separation
- **Lazy Loading**: Audio data loaded only when needed
- **Connection Pooling**: Database connection management
- **Efficient Pagination**: Token-based pagination for large datasets

## Development Phases

### Phase 1: Core Infrastructure
- [ ] Go project structure setup
- [ ] Protobuf service definition
- [ ] Connect RPC server implementation
- [ ] In-memory repository implementation
- [ ] Basic file upload/download functionality

### Phase 2: Audio Processing
- [ ] Background processing system
- [ ] demucs CLI integration
- [ ] File management and storage
- [ ] Audio mixing for karaoke versions

### Phase 3: Library Management
- [ ] Metadata extraction from audio files
- [ ] Lyrics parsing and synchronization
- [ ] Song listing and filtering
- [ ] Cover art handling and processing

### Phase 4: Production Readiness
- [ ] PostgreSQL repository implementation
- [ ] Configuration management system
- [ ] Comprehensive error handling and logging
- [ ] Testing suite and documentation

## Design Principles

- **Simplicity**: Favor clear, straightforward solutions over complex ones
- **Consistency**: Uniform naming conventions and patterns throughout
- **Flexibility**: Support for multiple audio versions and formats
- **Performance**: Efficient handling of large audio files and libraries
- **Maintainability**: Clean separation of concerns and modular design
