import { useEffect, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { SegmentedControl, Slider } from '@skeletonlabs/skeleton-react';
import {
  ListMusicIcon,
  MicVocalIcon,
  MinusIcon,
  MonitorUpIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import { usePlayer } from '../player/store';
import { activeLineIndex, parseLyrics } from '../lib/lyrics';
import { useCoverColors } from '../lib/useCoverColors';
import { formatTime } from '../lib/format';
import { toaster } from '../toaster';
import CoverArt from '../components/CoverArt';
import LyricsDisplay from '../components/LyricsDisplay';
import type { PlayMode } from '../player/engine';

const LYRICS_NUDGE_MS = 250;

function openStageWindow() {
  window.open('/stage', 'voxstrip-stage', 'popup,width=1280,height=720');
}

// PlayerView is the main karaoke screen: synced lyrics over an album-art
// gradient, with playback, vocal-guide blend, and stage display controls.
export default function PlayerView() {
  const player = usePlayer();
  const { currentSong, engine } = player;
  const colors = useCoverColors(currentSong?.songId ?? null);

  const lyrics = useMemo(() => parseLyrics(currentSong?.metadata?.lyrics), [currentSong?.metadata?.lyrics]);
  const activeIndex = activeLineIndex(lyrics, engine.currentTime, player.lyricsOffsetMs);

  useEffect(() => {
    if (engine.error) {
      toaster.error({ title: 'Playback error', description: engine.error });
    }
  }, [engine.error]);

  if (!currentSong) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="card preset-tonal-surface flex max-w-md flex-col items-center gap-6 p-12 text-center">
          <PlayIcon className="size-16 text-surface-500" />
          <div>
            <h2 className="h3 mb-2">Nothing playing</h2>
            <p className="text-surface-600-400">Queue up some songs to start the karaoke.</p>
          </div>
          <Link to="/songs" className="btn preset-filled-primary-500">
            Browse Songs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Album-art gradient backdrop with a darkening overlay for contrast. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})` }}
      />
      <div className="absolute inset-0 bg-black/55" />

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-h-full w-full max-w-5xl">
          <LyricsDisplay lyrics={lyrics} activeIndex={activeIndex} onLineClick={(t) => player.seek(t)} />
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-surface-50-950/80 p-4 backdrop-blur-md">
        <div className="mb-1 flex justify-between font-mono text-xs text-surface-600-400">
          <span>{formatTime(engine.currentTime)}</span>
          <span>{formatTime(engine.duration)}</span>
        </div>
        <Slider
          value={[engine.currentTime]}
          max={engine.duration || 1}
          step={0.5}
          onValueChange={(details) => player.seek(details.value[0])}
          className="mb-4"
          aria-label={['Seek']}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0}>
              <Slider.HiddenInput />
            </Slider.Thumb>
          </Slider.Control>
        </Slider>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* Song identity + transport */}
          <div className="flex items-center gap-3">
            <CoverArt
              key={currentSong.songId}
              songId={currentSong.songId}
              alt=""
              className="hidden size-12 rounded-base sm:block"
            />
            <div className="hidden w-44 sm:block">
              <p className="truncate text-sm font-semibold">{currentSong.metadata?.title || 'Unknown Title'}</p>
              <p className="truncate text-xs text-surface-600-400">
                {currentSong.metadata?.artist || 'Unknown Artist'}
              </p>
            </div>
            <button
              type="button"
              onClick={player.previous}
              disabled={player.currentIndex <= 0}
              className="btn-icon hover:preset-tonal disabled:opacity-40"
              aria-label="Previous"
            >
              <SkipBackIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={player.togglePlay}
              className="btn-icon btn-icon-lg preset-filled-primary-500 shadow-lg"
              aria-label={engine.isPlaying ? 'Pause' : 'Play'}
            >
              {engine.isPlaying ? <PauseIcon className="size-6" /> : <PlayIcon className="size-6" />}
            </button>
            <button
              type="button"
              onClick={player.next}
              disabled={player.currentIndex >= player.queue.length - 1}
              className="btn-icon hover:preset-tonal disabled:opacity-40"
              aria-label="Next"
            >
              <SkipForwardIcon className="size-5" />
            </button>
          </div>

          {/* Mode + vocal guide blend */}
          <div className="flex items-center gap-4">
            <SegmentedControl
              value={player.mode}
              onValueChange={(details) => player.setMode(details.value as PlayMode)}
            >
              <SegmentedControl.Control>
                <SegmentedControl.Indicator />
                <SegmentedControl.Item value="stems">
                  <SegmentedControl.ItemText className="text-xs">Karaoke</SegmentedControl.ItemText>
                  <SegmentedControl.ItemHiddenInput />
                </SegmentedControl.Item>
                <SegmentedControl.Item value="original">
                  <SegmentedControl.ItemText className="text-xs">Original</SegmentedControl.ItemText>
                  <SegmentedControl.ItemHiddenInput />
                </SegmentedControl.Item>
              </SegmentedControl.Control>
            </SegmentedControl>

            <div
              className={`flex items-center gap-2 ${player.mode === 'original' ? 'pointer-events-none opacity-40' : ''}`}
              title="Guide vocals level"
            >
              <MicVocalIcon className="size-4 shrink-0 text-surface-600-400" />
              <Slider
                value={[player.vocalLevel * 100]}
                max={100}
                step={5}
                onValueChange={(details) => player.setVocalLevel(details.value[0] / 100)}
                className="w-28"
                aria-label={['Guide vocal level']}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                </Slider.Control>
              </Slider>
              <span className="w-8 font-mono text-xs text-surface-600-400">{Math.round(player.vocalLevel * 100)}%</span>
            </div>
          </div>

          {/* Volume, lyric offset, stage, queue */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => player.setVolume(player.volume > 0 ? 0 : 1)}
              className="btn-icon hover:preset-tonal"
              aria-label="Toggle mute"
            >
              {player.volume > 0 ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
            </button>
            <Slider
              value={[player.volume * 100]}
              max={100}
              step={5}
              onValueChange={(details) => player.setVolume(details.value[0] / 100)}
              className="w-24"
              aria-label={['Volume']}
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumb index={0}>
                  <Slider.HiddenInput />
                </Slider.Thumb>
              </Slider.Control>
            </Slider>

            {lyrics.synced && (
              <div className="flex items-center gap-1" title="Nudge lyrics timing">
                <button
                  type="button"
                  onClick={() => player.setLyricsOffsetMs(player.lyricsOffsetMs - LYRICS_NUDGE_MS)}
                  className="btn-icon btn-icon-sm hover:preset-tonal"
                  aria-label="Lyrics earlier"
                >
                  <MinusIcon className="size-3" />
                </button>
                <span className="w-14 text-center font-mono text-xs text-surface-600-400">
                  {player.lyricsOffsetMs > 0 ? '+' : ''}
                  {player.lyricsOffsetMs} ms
                </span>
                <button
                  type="button"
                  onClick={() => player.setLyricsOffsetMs(player.lyricsOffsetMs + LYRICS_NUDGE_MS)}
                  className="btn-icon btn-icon-sm hover:preset-tonal"
                  aria-label="Lyrics later"
                >
                  <PlusIcon className="size-3" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={openStageWindow}
              className="btn-icon hover:preset-tonal"
              title="Open stage display (drag to your TV, then click it for fullscreen)"
            >
              <MonitorUpIcon className="size-4" />
            </button>
            <Link to="/queue" className="btn-icon hover:preset-tonal" title="View queue">
              <ListMusicIcon className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
