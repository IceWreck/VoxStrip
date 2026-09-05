// Package webui embeds the built React frontend into the binary and serves it
// with a single-page-app fallback.
package webui

import (
	"bytes"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"
)

// dist holds the Vite build output. The all: prefix keeps files Vite may emit
// with a leading dot or underscore, which go:embed otherwise skips. A build
// without a prior `make ui-build` embeds only the .gitkeep placeholder; Handler
// degrades to a clear error rather than failing to compile.
//
//go:embed all:dist
var dist embed.FS

// Handler returns an http.Handler serving the embedded frontend. Paths that do
// not match an embedded file fall back to index.html so client-side routes
// survive a hard refresh.
func Handler() http.Handler {
	files, err := fs.Sub(dist, "dist")
	if err != nil {
		slog.Error("failed to open embedded ui files", "error", err)
		return notBuiltHandler()
	}

	index, err := fs.ReadFile(files, "index.html")
	if err != nil {
		slog.Warn("binary has no ui build embedded", "hint", "run make ui-build and rebuild")
		return notBuiltHandler()
	}

	fileServer := http.FileServerFS(files)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if exists(files, r.URL.Path) {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
}

// exists reports whether a request path maps to an embedded regular file.
func exists(files fs.FS, requestPath string) bool {
	name := strings.TrimPrefix(path.Clean("/"+requestPath), "/")
	if name == "" {
		name = "index.html"
	}
	info, err := fs.Stat(files, name)
	return err == nil && !info.IsDir()
}

func notBuiltHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "ui not bundled into this binary", http.StatusNotFound)
	})
}
