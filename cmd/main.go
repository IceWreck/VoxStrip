package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/IceWreck/VoxStrip/pkg/api"
	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/logger"
	"github.com/IceWreck/VoxStrip/pkg/store/sqlite"
)

func main() {
	// Setup logging
	logger.SetupLogging()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Initialize store
	store, err := sqlite.NewStore(cfg.Database.Path)
	if err != nil {
		slog.Error("failed to initialize store", "error", err)
		os.Exit(1)
	}
	defer store.Close()

	// Initialize blobstore
	blobstore, err := blobstore.NewFileSystemStore(cfg.Storage.BlobStoreDir)
	if err != nil {
		slog.Error("failed to initialize blobstore", "error", err)
		os.Exit(1)
	}

	// Initialize service
	service := api.NewService(store, cfg, blobstore)

	// Setup server
	handler, err := api.NewServer(service)
	if err != nil {
		slog.Error("failed to create server", "error", err)
		os.Exit(1)
	}

	// Start server
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	slog.Info("starting server", "address", addr)

	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}
