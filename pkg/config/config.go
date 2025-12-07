package config

import (
	"github.com/caarlos0/env/v11"
)

type Config struct {
	Server struct {
		Port string `env:"PORT" envDefault:"8080"`
		Host string `env:"HOST" envDefault:"0.0.0.0"`
	}

	Database struct {
		Path string `env:"DB_PATH" envDefault:"./data/voxstrip.db"`
	}

	Storage struct {
		BlobStoreDir string `env:"BLOBSTORE_DIR" envDefault:"./data/blobs"`
	}
}

func Load() (*Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
