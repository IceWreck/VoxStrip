package api

import (
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/store"
)

// audioVersionFileTypes maps the {version} path segment of media URLs to
// blobstore file types.
var audioVersionFileTypes = map[string]blobstore.FileType{
	"original":     blobstore.FileTypeOriginal,
	"vocal":        blobstore.FileTypeVocal,
	"instrumental": blobstore.FileTypeInstrumental,
}

// registerMediaRoutes adds plain HTTP media endpoints alongside the RPC
// handlers. Serving media over GET lets browsers stream audio with Range
// requests and cache cover art, which protobuf byte responses cannot do.
func registerMediaRoutes(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("GET /media/{songID}/cover", func(w http.ResponseWriter, r *http.Request) {
		serveMedia(service, w, r, blobstore.FileTypeCoverArt, false)
	})
	mux.HandleFunc("GET /media/{songID}/audio/{version}", func(w http.ResponseWriter, r *http.Request) {
		fileType, ok := audioVersionFileTypes[r.PathValue("version")]
		if !ok {
			http.Error(w, "unknown audio version", http.StatusNotFound)
			return
		}
		serveMedia(service, w, r, fileType, true)
	})
}

// serveMedia streams a blob for a song over HTTP. Audio requires processing to
// be completed so partially generated stems are never served; cover art is
// available in any status.
func serveMedia(service *Service, w http.ResponseWriter, r *http.Request, fileType blobstore.FileType, requireCompleted bool) {
	songID := r.PathValue("songID")
	if err := service.validateSongID(songID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	song, err := service.store.GetSong(r.Context(), songID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			http.Error(w, "song not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to get song for media", "id", songID, "error", err)
		http.Error(w, "failed to load song", http.StatusInternalServerError)
		return
	}
	if requireCompleted && song.ProcessingStatus != store.ProcessingStatusCompleted {
		http.Error(w, "song not ready", http.StatusConflict)
		return
	}

	reader, blobInfo, err := service.blobstore.Get(r.Context(), songID, fileType)
	if err != nil {
		if errors.Is(err, blobstore.ErrNotFound) {
			http.Error(w, "media not found", http.StatusNotFound)
			return
		}
		slog.Error("failed to get media blob", "id", songID, "file_type", fileType, "error", err)
		http.Error(w, "failed to retrieve media", http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	if blobInfo.ContentType != "" {
		w.Header().Set("Content-Type", blobInfo.ContentType)
	}
	// Media is immutable once processed, so let the browser cache it.
	w.Header().Set("Cache-Control", "private, max-age=86400")

	// The filesystem blobstore returns *os.File, which supports seeking and
	// therefore HTTP Range requests via ServeContent.
	if seeker, ok := reader.(io.ReadSeeker); ok {
		http.ServeContent(w, r, "", blobInfo.LastModified, seeker)
		return
	}

	if _, err := io.Copy(w, reader); err != nil {
		slog.Error("failed to stream media blob", "id", songID, "file_type", fileType, "error", err)
	}
}
