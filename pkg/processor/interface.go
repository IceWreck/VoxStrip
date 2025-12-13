package processor

import (
	"context"
	"log/slog"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store"
)

// audioProcessor is the main processor implementation
type audioProcessor struct {
	store     store.Store
	blobStore blobstore.Store
	config    config.Config
	workers   []*worker
	stopCh    chan struct{}
}

// New creates a new audio processor
func New(store store.Store, blobStore blobstore.Store, config config.Config) *audioProcessor {
	return &audioProcessor{
		store:     store,
		blobStore: blobStore,
		config:    config,
		stopCh:    make(chan struct{}),
	}
}

// Start begins the audio processing workers
func (p *audioProcessor) Start(ctx context.Context) error {
	slog.Info("starting audio processor", "worker_count", p.config.AudioProcessing.WorkerCount)

	p.workers = make([]*worker, p.config.AudioProcessing.WorkerCount)
	for i := 0; i < p.config.AudioProcessing.WorkerCount; i++ {
		w := &worker{
			id:        i,
			store:     p.store,
			blobStore: p.blobStore,
			config:    p.config.AudioProcessing,
			stopCh:    p.stopCh,
		}
		p.workers[i] = w

		go w.run(ctx)
	}

	slog.Info("audio processor started successfully")
	return nil
}

// Stop stops all audio processing workers
func (p *audioProcessor) Stop() error {
	slog.Info("stopping audio processor")
	close(p.stopCh)

	// Wait for all workers to finish
	for _, w := range p.workers {
		w.wait()
	}

	slog.Info("audio processor stopped")
	return nil
}
