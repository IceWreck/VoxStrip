package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/api"
	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/logger"
	"github.com/IceWreck/VoxStrip/pkg/processor"
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

	// Initialize audio processor with a cancellable context so shutdown can
	// abort in-flight processing instead of waiting out a full demucs run
	processorCtx, cancelProcessor := context.WithCancel(context.Background())
	defer cancelProcessor()

	audioProcessor := processor.New(store, blobstore, *cfg)
	if err := audioProcessor.Start(processorCtx); err != nil {
		slog.Error("audio processor failed to start", "error", err)
		os.Exit(1)
	}

	// Setup server
	handler, err := api.NewServer(service, cfg)
	if err != nil {
		slog.Error("failed to create server", "error", err)
		os.Exit(1)
	}

	// Start server
	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	slog.Info("starting server", "address", addr)

	// Configure server with HTTP/2 support
	p := new(http.Protocols)
	p.SetHTTP1(true)
	p.SetUnencryptedHTTP2(true)

	server := &http.Server{
		Addr:      addr,
		Handler:   handler,
		Protocols: p,
	}

	// Graceful shutdown
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server")

	// Stop audio processor; cancelling the context kills any in-flight demucs
	cancelProcessor()
	if err := audioProcessor.Stop(); err != nil {
		slog.Error("failed to stop audio processor", "error", err)
	}

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server shutdown complete")
}
