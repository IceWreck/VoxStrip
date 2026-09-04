package api

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"slices"
	"time"

	"connectrpc.com/connect"
	connectcors "connectrpc.com/cors"
	voxstripv1connect "github.com/IceWreck/VoxStrip/gen/proto/voxstripv1connect"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/rs/cors"
)

// NewServer creates a new HTTP server with Connect RPC handlers
func NewServer(service *Service, cfg *config.Config, opts ...connect.HandlerOption) (http.Handler, error) {
	mux := http.NewServeMux()

	// Add logging interceptor and cap request size: imports carry whole audio
	// files as proto bytes (50MB per song), anything beyond this is abuse
	opts = append(opts,
		connect.WithInterceptors(loggingInterceptor()),
		connect.WithReadMaxBytes(256*1024*1024),
	)

	// Create Connect RPC handler for KaraokeService
	path, handler := voxstripv1connect.NewKaraokeServiceHandler(service, opts...)
	mux.Handle(path, handler)

	// Add health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Add plain HTTP media endpoints for streaming audio and cacheable cover art
	registerMediaRoutes(mux, service)

	// Serve static React UI with SPA fallback
	fs := http.FileServer(http.Dir("ui/dist"))
	mux.Handle("/ui/", http.StripPrefix("/ui", fs))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if _, err := os.Stat("ui/dist" + r.URL.Path); err == nil {
			fs.ServeHTTP(w, r)
		} else {
			http.ServeFile(w, r, "ui/dist/index.html")
		}
	})

	// Add HTTP middleware for CORS and recovery
	handlerWithMiddleware := addHTTPMiddleware(mux, cfg)

	slog.Info("server created with Connect RPC handlers", "path", path)
	return handlerWithMiddleware, nil
}

// loggingInterceptor is a Connect RPC interceptor for request logging
func loggingInterceptor() connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			start := time.Now()
			slog.Info("rpc call started",
				"procedure", req.Spec().Procedure,
				"stream_type", req.Spec().StreamType,
			)

			resp, err := next(ctx, req)

			duration := time.Since(start)
			if err != nil {
				slog.Error("rpc call failed",
					"procedure", req.Spec().Procedure,
					"duration", duration,
					"error", err,
				)
			} else {
				slog.Info("rpc call completed",
					"procedure", req.Spec().Procedure,
					"duration", duration,
				)
			}

			return resp, err
		}
	}
}

// isAllowedOrigin reports whether a browser origin may make cross-origin
// requests: any localhost/127.0.0.1 origin, or an exact match from the
// configured allow-list. Same-origin requests never hit CORS at all.
func isAllowedOrigin(origin string, configured []string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := parsed.Hostname()
	if host == "localhost" || host == "127.0.0.1" {
		return true
	}
	return slices.Contains(configured, origin)
}

// addHTTPMiddleware adds HTTP-level middleware (CORS and recovery)
func addHTTPMiddleware(handler http.Handler, cfg *config.Config) http.Handler {
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

	// CORS middleware using Connect's recommended approach. An origin
	// allow-func (rather than a wildcard) makes the server echo the exact
	// origin, which is required for credentialed requests: the UI always
	// sends credentials for the reverse-proxy basicauth setup. Localhost
	// origins are always allowed so `make ui-dev` works out of the box.
	corsMiddleware := cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			return isAllowedOrigin(origin, cfg.CORS.AllowedOrigins)
		},
		AllowedMethods:   connectcors.AllowedMethods(),
		AllowedHeaders:   connectcors.AllowedHeaders(),
		ExposedHeaders:   connectcors.ExposedHeaders(),
		AllowCredentials: true,
	})

	// Apply middleware in correct order (outermost to innermost)
	handler = corsMiddleware.Handler(handler)
	handler = recovery(handler)

	return handler
}
