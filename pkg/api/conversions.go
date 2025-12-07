package api

import (
	"fmt"
	"time"

	voxstripv1 "github.com/IceWreck/VoxStrip/gen/proto"
	"github.com/IceWreck/VoxStrip/pkg/store"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
)

// songToProto converts a store.Song to voxstripv1.Song
func songToProto(song *store.Song) *voxstripv1.Song {
	if song == nil {
		return nil
	}

	return &voxstripv1.Song{
		SongId:               song.ID,
		Metadata:             metadataToProto(song.Metadata),
		CreatedAt:            timestamppb.New(song.CreatedAt),
		UpdatedAt:            timestamppb.New(song.UpdatedAt),
		ProcessingStatus:     processingStatusToProto(song.ProcessingStatus),
		ProcessingError:      song.ProcessingError,
		OriginalFilePath:     song.OriginalFilePath,
		VocalFilePath:        song.VocalFilePath,
		InstrumentalFilePath: song.InstrumentalFilePath,
		CoverArtPath:         song.CoverArtPath,
		DurationMs:           song.DurationMs,
	}
}

// protoToSong converts a voxstripv1.Song to store.Song
func protoToSong(protoSong *voxstripv1.Song) (*store.Song, error) {
	if protoSong == nil {
		return nil, fmt.Errorf("proto song is nil")
	}

	createdAt, err := timestampToTime(protoSong.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid created_at timestamp: %w", err)
	}

	updatedAt, err := timestampToTime(protoSong.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("invalid updated_at timestamp: %w", err)
	}

	metadata, err := protoToMetadata(protoSong.Metadata)
	if err != nil {
		return nil, fmt.Errorf("invalid metadata: %w", err)
	}

	return &store.Song{
		ID:                   protoSong.SongId,
		Metadata:             *metadata,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
		ProcessingStatus:     processingStatusFromProto(protoSong.ProcessingStatus),
		ProcessingError:      protoSong.ProcessingError,
		OriginalFilePath:     protoSong.OriginalFilePath,
		VocalFilePath:        protoSong.VocalFilePath,
		InstrumentalFilePath: protoSong.InstrumentalFilePath,
		CoverArtPath:         protoSong.CoverArtPath,
		DurationMs:           protoSong.DurationMs,
	}, nil
}

// metadataToProto converts store.Metadata to voxstripv1.SongMetadata
func metadataToProto(metadata store.Metadata) *voxstripv1.SongMetadata {
	return &voxstripv1.SongMetadata{
		Title:       metadata.Title,
		Artist:      metadata.Artist,
		Album:       metadata.Album,
		AlbumArtist: metadata.AlbumArtist,
		Genre:       metadata.Genre,
		Lyrics:      metadata.Lyrics,
	}
}

// protoToMetadata converts voxstripv1.SongMetadata to store.Metadata
func protoToMetadata(protoMetadata *voxstripv1.SongMetadata) (*store.Metadata, error) {
	if protoMetadata == nil {
		return nil, fmt.Errorf("proto metadata is nil")
	}

	return &store.Metadata{
		Title:       protoMetadata.Title,
		Artist:      protoMetadata.Artist,
		Album:       protoMetadata.Album,
		AlbumArtist: protoMetadata.AlbumArtist,
		Genre:       protoMetadata.Genre,
		Lyrics:      protoMetadata.Lyrics,
	}, nil
}

// processingStatusToProto converts store.ProcessingStatus to voxstripv1.ProcessingStatus
func processingStatusToProto(status store.ProcessingStatus) voxstripv1.ProcessingStatus {
	switch status {
	case store.ProcessingStatusUnspecified:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_UNSPECIFIED
	case store.ProcessingStatusPending:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_PENDING
	case store.ProcessingStatusProcessing:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_PROCESSING
	case store.ProcessingStatusCompleted:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_COMPLETED
	case store.ProcessingStatusFailed:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED
	default:
		return voxstripv1.ProcessingStatus_PROCESSING_STATUS_UNSPECIFIED
	}
}

// processingStatusFromProto converts voxstripv1.ProcessingStatus to store.ProcessingStatus
func processingStatusFromProto(status voxstripv1.ProcessingStatus) store.ProcessingStatus {
	switch status {
	case voxstripv1.ProcessingStatus_PROCESSING_STATUS_UNSPECIFIED:
		return store.ProcessingStatusUnspecified
	case voxstripv1.ProcessingStatus_PROCESSING_STATUS_PENDING:
		return store.ProcessingStatusPending
	case voxstripv1.ProcessingStatus_PROCESSING_STATUS_PROCESSING:
		return store.ProcessingStatusProcessing
	case voxstripv1.ProcessingStatus_PROCESSING_STATUS_COMPLETED:
		return store.ProcessingStatusCompleted
	case voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED:
		return store.ProcessingStatusFailed
	default:
		return store.ProcessingStatusUnspecified
	}
}

// timestampToTime converts timestamppb.Timestamp to time.Time
func timestampToTime(ts *timestamppb.Timestamp) (time.Time, error) {
	if ts == nil {
		return time.Time{}, fmt.Errorf("timestamp is nil")
	}
	if !ts.IsValid() {
		return time.Time{}, fmt.Errorf("invalid timestamp")
	}
	return ts.AsTime(), nil
}

// songsToProto converts a slice of store.Song to a slice of voxstripv1.Song
func songsToProto(songs []*store.Song) []*voxstripv1.Song {
	if songs == nil {
		return nil
	}

	protoSongs := make([]*voxstripv1.Song, len(songs))
	for i, song := range songs {
		protoSongs[i] = songToProto(song)
	}
	return protoSongs
}
