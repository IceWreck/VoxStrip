# Audio Processing System

The VoxStrip audio processing system handles background processing of uploaded audio files to extract metadata and separate vocals from instruments.

## Architecture

### Components

1. **Processor** (`pkg/processor/interface.go`)
   - Main coordinator that manages worker pool
   - Handles graceful startup and shutdown
   - Configurable worker count and polling interval

2. **Worker** (`pkg/processor/worker.go`)
   - Individual processing unit
   - Polls for PENDING songs every 5 seconds
   - Executes two-step processing pipeline:
     1. Metadata extraction using taglib
     2. Audio separation using Demucs CLI

3. **Metadata Extractor** (`pkg/processor/metadata.go`)
   - Uses `go.senan.xyz/taglib` for audio tag extraction
   - Extracts: title, artist, album, album artist, genre, lyrics
   - Detects audio duration in milliseconds

4. **Audio Separator** (`pkg/processor/demucs.go`)
   - Wrapper around Demucs CLI tool
   - Uses `htdemucs` model by default
   - Outputs MP3 files at 320kbps quality
   - Creates separate vocal and instrumental tracks

## Configuration

Environment variables:

- `AUDIO_WORKER_COUNT`: Number of concurrent workers (default: 2)
- `AUDIO_POLL_INTERVAL`: Polling interval for pending songs (default: 5s)
- `AUDIO_PROCESSING_TIMEOUT`: Timeout per song processing (default: 20m)
- `DEMUCS_COMMAND`: Command to execute Demucs CLI (default: uv run demucs)
- `AUDIO_TEMP_DIR`: Temporary directory for processing (default: ./temp)

## Processing Pipeline

1. **Song Import**: Client uploads audio file via API
2. **Initial State**: Song created with `PENDING` status
3. **Worker Pickup**: Worker polls and claims song, status → `PROCESSING`
4. **Metadata Extraction**: Extract tags using taglib, update song metadata
5. **Audio Separation**: Run Demucs to separate vocals and instruments
6. **File Storage**: Store vocal and instrumental tracks in blobstore
7. **Completion**: Status → `COMPLETED` or `FAILED` (with error details)

## Error Handling

- No retry logic - if processing fails, song is marked as `FAILED`
- Detailed error messages stored in `processing_error` field
- Failed songs remain in system for debugging
- Processing timeout after 20 minutes per song

## External Dependencies

### Input Files
- Original audio files stored in blobstore as `FileTypeOriginal`

### Output Files
- Vocal tracks stored as `FileTypeVocal`
- Instrumental tracks stored as `FileTypeInstrumental`
- All processed files are MP3 format at 320kbps

### Temporary Files
- Processing creates temporary directories under `AUDIO_TEMP_DIR`
- Files are cleaned up automatically after processing
- Each song gets its own temporary directory

## Monitoring

The processor logs structured information using `slog`:

- Worker startup/shutdown events
- Song processing start/completion/failure
- Metadata extraction results
- Audio separation progress
- Error details with context

## Performance Considerations

- **Concurrent Processing**: Multiple workers can process songs simultaneously
- **Database Efficiency**: Uses indexed queries on `processing_status` for fast polling
- **Memory Usage**: Temporary files are cleaned up promptly
- **Timeout Protection**: 20-minute timeout prevents hung processes

## Integration Points

The processor integrates with existing VoxStrip components:

- **Store Interface**: Uses existing song repository for status management
- **BlobStore Interface**: Stores and retrieves audio files
- **Configuration System**: Environment-based configuration
- **Logging**: Uses structured logging with `slog`
