package logger

import (
	"log/slog"
	"os"
)

// SetupLogging configures the global slog logger with sensible defaults.
func SetupLogging() {
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})
	slog.SetDefault(slog.New(handler))
}
