package config

import (
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	Server struct {
		Port string `env:"PORT" envDefault:"8080"`
		Host string `env:"HOST" envDefault:"0.0.0.0"`
	}

	CORS struct {
		AllowedOrigins []string `env:"CORS_ALLOWED_ORIGINS" envSeparator:","`
	}

	Database struct {
		Path string `env:"DB_PATH" envDefault:"./data/voxstrip.db"`
	}

	Storage struct {
		BlobStoreDir string `env:"BLOBSTORE_DIR" envDefault:"./data/blobs"`
	}

	AudioProcessing AudioProcessingConfig
}

// AudioProcessingConfig holds configuration for audio processing
type AudioProcessingConfig struct {
	WorkerCount       int           `env:"AUDIO_WORKER_COUNT" envDefault:"2"`
	PollInterval      time.Duration `env:"AUDIO_POLL_INTERVAL" envDefault:"5s"`
	ProcessingTimeout time.Duration `env:"AUDIO_PROCESSING_TIMEOUT" envDefault:"20m"`
	DemucsCommand     string        `env:"DEMUCS_COMMAND" envDefault:"uvx --with torchcodec demucs"`
	DemucsModel       string        `env:"DEMUCS_MODEL" envDefault:"htdemucs"`
	TempDir           string        `env:"AUDIO_TEMP_DIR" envDefault:"./temp"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
