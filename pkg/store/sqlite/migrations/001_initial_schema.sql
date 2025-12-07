CREATE TABLE songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    album_artist TEXT,
    genre TEXT,
    lyrics TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    processing_status INTEGER NOT NULL DEFAULT 1,
    processing_error TEXT,
    duration_ms INTEGER
);

CREATE INDEX idx_songs_status ON songs(processing_status);
CREATE INDEX idx_songs_created_at ON songs(created_at);