package api

import (
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
		SongId:           song.ID,
		Metadata:         metadataToProto(song.Metadata),
		CreatedAt:        timestamppb.New(song.CreatedAt),
		UpdatedAt:        timestamppb.New(song.UpdatedAt),
		ProcessingStatus: processingStatusToProto(song.ProcessingStatus),
		ProcessingError:  song.ProcessingError,
		DurationMs:       song.DurationMs,
	}
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
