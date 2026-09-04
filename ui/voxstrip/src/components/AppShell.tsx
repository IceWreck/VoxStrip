import { useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toast } from '@skeletonlabs/skeleton-react';
import Sidebar from './Sidebar';
import MiniPlayer from './MiniPlayer';
import { PlayerProvider, usePlayback, usePlayer } from '../player/store';
import { toaster } from '../toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// useKeyboardShortcuts wires global playback keys: space (play/pause),
// arrows (seek), n/p (next/previous). Inputs and dialogs are left alone.
function useKeyboardShortcuts() {
  const player = usePlayer();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      // Slider thumbs keep focus after interaction and handle arrows
      // themselves; global seek on top would double-fire.
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"]')) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          player.togglePlay();
          break;
        case 'ArrowLeft':
          player.seekBy(-5);
          break;
        case 'ArrowRight':
          player.seekBy(5);
          break;
        case 'n':
          player.next();
          break;
        case 'p':
          player.previous();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player]);
}

// usePlaybackErrorToasts surfaces playback failures on every view, not just
// the full player — a load error with only the mini player visible would
// otherwise be silent.
function usePlaybackErrorToasts() {
  const { error } = usePlayback();
  useEffect(() => {
    if (error) {
      toaster.error({ title: 'Playback error', description: error });
    }
  }, [error]);
}

function ShellLayout() {
  useKeyboardShortcuts();
  usePlaybackErrorToasts();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The full player has its own control bar; the mini player would duplicate it.
  const showMiniPlayer = pathname !== '/player';

  return (
    <div className="flex h-screen flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {showMiniPlayer && <MiniPlayer />}

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
    </div>
  );
}

// AppShell provides query + player context for all library routes. The stage
// display route lives outside this shell so it never instantiates an engine.
export default function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider>
        <ShellLayout />
      </PlayerProvider>
    </QueryClientProvider>
  );
}
