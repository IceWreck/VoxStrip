package api

import (
	"log/slog"
	"net/http"

	"connectrpc.com/connect"
	voxstripv1connect "github.com/IceWreck/VoxStrip/gen/proto/voxstripv1connect"
)

// NewServer creates a new HTTP server with Connect RPC handlers
func NewServer(service *Service, opts ...connect.HandlerOption) (http.Handler, error) {
	mux := http.NewServeMux()

	// Create Connect RPC handler for KaraokeService
	path, handler := voxstripv1connect.NewKaraokeServiceHandler(service, opts...)
	mux.Handle(path, handler)

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Add middleware for logging and recovery
	handlerWithMiddleware := addMiddleware(mux)

	slog.Info("server created with Connect RPC handlers", "path", path)
	return handlerWithMiddleware, nil
}

// addMiddleware adds common middleware to the handler
func addMiddleware(handler http.Handler) http.Handler {
	// Recovery middleware
	recovery := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					slog.Error("panic recovered", "error", err, "path", r.URL.Path, "method", r.Method)
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}

	// Logging middleware
	logging := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slog.Info("request received", "method", r.Method, "path", r.URL.Path, "remote", r.RemoteAddr)
			next.ServeHTTP(w, r)
		})
	}

	// CORS middleware (for development)
	cors := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Connect-Protocol-Version")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}

	// Apply middleware in order
	handler = recovery(handler)
	handler = logging(handler)
	handler = cors(handler)

	return handler
}
