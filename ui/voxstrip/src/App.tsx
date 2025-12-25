import { Outlet } from '@tanstack/react-router';
import Sidebar from './components/Sidebar.js';
import { useQueue } from './hooks/useQueue.js';
import { useAudioPlayer } from './hooks/useAudioPlayer.js';
import { AppContext } from './router/context.js';
import { useEffect, useRef } from 'react';
import { DEFAULT_AUDIO_VERSION } from './config.js';
import { Toast } from '@skeletonlabs/skeleton-react';
import { toaster } from './toaster.js';

function App() {
  const queue = useQueue();
  const audioPlayer = useAudioPlayer(() => queue.playNext());
  const lastSyncedSongId = useRef<string | null>(null);

  // Sync queue current song with audio player
  useEffect(() => {
    const currentSongId = queue.currentSong?.songId || null;
    if (currentSongId && currentSongId !== lastSyncedSongId.current) {
      lastSyncedSongId.current = currentSongId;
      // Load the current queue song in the default audio version
      audioPlayer.loadSong(queue.currentSong!, DEFAULT_AUDIO_VERSION);
    }
  }, [queue.currentSong, audioPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync playing state - queue controls audio player
  useEffect(() => {
    if (queue.isPlaying && !audioPlayer.isPlaying && queue.currentSong && !audioPlayer.isLoading) {
      audioPlayer.play();
    } else if (!queue.isPlaying && audioPlayer.isPlaying) {
      audioPlayer.pause();
    }
  }, [queue.isPlaying, audioPlayer.isPlaying, audioPlayer.isLoading, queue.currentSong, audioPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ queue, audioPlayer }}>
      <div className="h-screen grid grid-cols-[auto_1fr] overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="overflow-auto bg-surface-50-950">
          <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Toast notifications */}
      <Toast.Group toaster={toaster}>
        {(toast) => (
          <Toast toast={toast} key={toast.id}>
            <Toast.Message>
              <Toast.Title>{toast.title}</Toast.Title>
              <Toast.Description>{toast.description}</Toast.Description>
            </Toast.Message>
            <Toast.CloseTrigger />
          </Toast>
        )}
      </Toast.Group>
    </AppContext.Provider>
  );
}

export default App;