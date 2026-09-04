package processor

import (
	"context"
	"log/slog"
	"sync"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store"
)

// audioProcessor is the main processor implementation
type audioProcessor struct {
	store     store.Store
	blobStore blobstore.Store
	config    config.Config
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// New creates a new audio processor
func New(store store.Store, blobStore blobstore.Store, config config.Config) *audioProcessor {
	return &audioProcessor{
		store:     store,
		blobStore: blobStore,
		config:    config,
	}
}

// Start begins the audio processing workers
func (p *audioProcessor) Start(ctx context.Context) error {
	slog.Info("starting audio processor", "worker_count", p.config.AudioProcessing.WorkerCount)

	// Songs left in the processing state by a crash or restart would never be
	// claimed again, so requeue them first.
	requeued, err := p.store.RequeueProcessingSongs(ctx)
	if err != nil {
		slog.Error("failed to requeue stuck songs", "error", err)
	} else if requeued > 0 {
		slog.Info("requeued songs stuck in processing", "count", requeued)
	}

	ctx, p.cancel = context.WithCancel(ctx)

	for i := 0; i < p.config.AudioProcessing.WorkerCount; i++ {
		w := &worker{
			id:        i,
			store:     p.store,
			blobStore: p.blobStore,
			config:    p.config.AudioProcessing,
		}

		p.wg.Add(1)
		go func() {
			defer p.wg.Done()
			w.run(ctx)
		}()
	}

	slog.Info("audio processor started successfully")
	return nil
}

// Stop cancels all audio processing workers and waits for them to exit. Any
// in-flight demucs run is killed via context cancellation.
func (p *audioProcessor) Stop() error {
	slog.Info("stopping audio processor")
	if p.cancel != nil {
		p.cancel()
	}
	p.wg.Wait()
	slog.Info("audio processor stopped")
	return nil
}
