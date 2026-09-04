# VoxStrip UI — Current Capabilities

This documents everything the existing UI (`ui/voxstrip/`) does, as a reference for the
ground-up rewrite. It describes observed behavior from the code, including quirks and
dead code, so we can decide deliberately what to keep, fix, or drop.

## Tech Stack

- React 19 + TypeScript, built with Vite.
- Skeleton (`@skeletonlabs/skeleton-react`) component library + Tailwind CSS v4.
- TanStack Router for routing, TanStack Table for the songs table.
- Connect RPC web client (`@connectrpc/connect-web`) with a generated TypeScript client
  from `proto/server.proto` (checked in at `src/proto/`).
- lucide-react for icons.

## App Shell & Navigation

- Fixed left sidebar (256px, sticky, full height) with links to the four routes:
  **Songs** (`/songs`), **Queue** (`/queue`), **Player** (`/player`), **Import** (`/import`).
  `/` redirects to `/songs`. Active route gets a filled highlight.
- Sidebar header is a VoxStrip logo/title that links to `/songs`.
- Sidebar footer shows a hardcoded "Connected" indicator with a pulsing green dot — it is
  purely decorative and does not reflect actual backend connectivity.
- Main content area scrolls with the scrollbar hidden (`scrollbar-hide`).
- Global toast notification system (Skeleton `Toast.Group` with a singleton toaster) used
  for success/warning/error feedback across all views.
- **Queue and playback state live in the root `App` component** (via React context holding
  a `useQueue` and a `useAudioPlayer` instance). This means it survives route changes but
  is lost entirely on page reload — nothing is persisted.

## Songs View (`/songs`)

Library browser for all imported songs.

- **Loading**: fetches the *entire* library up front by paging through `ListSongs` in
  batches of 500 until exhausted, deduplicating by song ID, with a circular progress
  indicator showing percent loaded. All subsequent search/sort/pagination is client-side.
- **Header**: total song count, and a Refresh button (spinning icon while loading) that
  refetches the whole library.
- **Search**: single text box that filters client-side, case-insensitive substring match
  against title, artist, album, and genre. Songs with no metadata are excluded from search
  results. An empty-results state offers a "Clear search" button.
- **Table** (TanStack Table): columns Title / Artist / Album / Duration / Status / Actions.
  - Title, Artist, Album are sortable (click header cycles asc → desc → unsorted, with
    arrow indicators). Duration and Status are not sortable.
  - Missing metadata renders as "Unknown Title" / "Unknown Artist" / "Unknown Album";
    missing duration renders `--:--`.
  - Status column shows a colored badge: Pending (gray), Processing (yellow),
    Completed (green), Failed (red).
- **Row actions**:
  - **Add** — adds the song to the playback queue and shows a success toast. Disabled
    unless processing status is COMPLETED.
  - **Delete** (trash icon) — opens a confirmation dialog; on confirm calls `DeleteSong`,
    shows a success/error toast, and refreshes the library.
- **Pagination**: client-side, with first/prev/next/last buttons, "Showing X to Y of Z"
  text, page indicator, and a page-size selector (10 / 15 / 50 / 100, default 10).
- **Error state**: inline error card with the API error message and a "Clear Error" button
  (clearing the error re-triggers the auto-load).

## Import View (`/import`)

Multi-file audio upload with optional per-file metadata overrides.

- **File selection**: drag-and-drop zone plus a "Browse Files" button. Accepts
  `audio/*` and `.ogg`, up to 100 files per selection. Selected files accumulate in a
  pending list (a smaller "add more files" dropzone appears once files are staged).
- **Pending files** render as cards in a responsive grid showing filename, formatted file
  size, and a badge with the count of metadata overrides set. Each card has:
  - **Edit Metadata** — opens a dialog with override fields: Title, Artist, Album,
    Album Artist, Genre, Lyrics (multiline), and a Cover Art image upload (with remove).
    Empty fields fall back to the metadata embedded in the audio file.
  - **Remove** — drops the file from the pending list.
- **Clear All** removes all pending files (disabled mid-import).
- **Import All**: reads every file (and any cover art override) into bytes in the browser
  and sends a single `ImportSongs` RPC containing all files and overrides. Shows a spinner
  while importing. Result handling based on per-song status in the response:
  - all PENDING → success toast, pending list cleared;
  - mixed → warning toast ("X succeeded, Y failed"), **pending list is kept** (including
    the successfully imported files, so re-importing would duplicate them);
  - all FAILED → error toast, list kept.
- There is no per-file upload progress, no chunking/streaming — whole files are held in
  memory and sent in one request.

## Queue View (`/queue`)

Playback queue management. The queue is a single ordered list with a current index;
"Upcoming" and "Played" are just the items after/before that index.

- **Header**: song count, "Open Player" link, and "Clear Queue" (resets everything,
  stops playback; no confirmation).
- **Now Playing card**: cover art, title, artist, a "NOW PLAYING" badge, playing/paused
  indicator, and (on desktop) current time / duration with a thin progress bar.
- **Upcoming list**: one card per upcoming song showing queue position number, cover art,
  title, artist, and duration. Cards support:
  - **Drag-and-drop reordering** (native HTML5 drag events on the whole card), with the
    current-index adjusted correctly when items move across it.
  - **Remove** (trash button, shown on hover). Removing the *currently playing* item
    resets the current index to 0 rather than advancing naturally.
- **Played section**: collapsible `<details>` list of already-played songs (dimmed),
  showing title, artist, duration.
- **Cover art**: batch-loaded for every song in the queue via `GetCoverArt` RPC and cached
  as blob object URLs (see Cover Art below). Fallback is a ♪ character avatar.
- Empty state prompts the user to add songs from the Songs view.

## Player View (`/player`)

Full-screen karaoke player.

- **Empty state** (no current song): "No song playing" card with a "Browse Songs" link.
- **Dynamic background**: fetches the current song's cover art, draws it to a canvas, and
  extracts the 3 most frequent quantized colors; renders a full-viewport diagonal gradient
  from those colors behind everything, with a 50% black overlay for readability. Falls
  back to dark grays on error. (Extraction result is also `console.log`ged.)
- **Synchronized lyrics** (the karaoke feature):
  - Parses LRC-style timestamps `[mm:ss.xx]` (2- or 3-digit fractional part) from the
    song's `metadata.lyrics`. Untimestamped non-empty lines are kept with time `-1`
    (they render in "previous/next" context but can never become the active line).
  - Display is centered: up to 2 previous lines at 40% opacity, the current line huge and
    bold (up to `text-7xl`), and the next 2 lines at 75% opacity.
  - The active line is derived from the audio player's current time on every time update.
  - There is no auto-scroll container, no click-to-seek on a lyric, and no handling for
    songs without lyrics beyond showing nothing.
- **Fixed bottom control bar** (spans the main area, backdrop-blurred):
  - Seek slider with current time / total duration labels (mm:ss).
  - Previous / Play-Pause / Next buttons. Previous is disabled at index 0; Next is
    disabled on the last queue item (so the end-of-queue auto-stop only happens on
    natural track end, not via the button). Play with an empty player but non-empty
    queue jumps to queue index 0.
  - **Audio version selector** (segmented control): Original / Vocal / Instrumental /
    Karaoke. Default is **Instrumental**. Changing it re-downloads and reloads the audio
    for the current song at the same version selection (playback position is lost).
    Disabled while the song's processing is not COMPLETED.
  - Volume: mute-toggle button (sets volume to 0 or 1) plus a 0–1 slider (step 0.05).
  - A queue shortcut button linking to `/queue`.
- Playback errors surface as an error toast.

## Playback Engine (`useAudioPlayer`)

- Single hidden `HTMLAudioElement` created once for the app's lifetime.
- **Loading a song downloads the entire audio file over RPC** (`DownloadAudio` with
  version, format=MP3, bitrate=320), wraps the bytes in a `Blob`, and plays via an object
  URL. There is no streaming — playback cannot start until the full file has transferred,
  and each version switch is a full re-download. Old blob URLs are revoked on replace and
  on unmount.
- Tracks: current song, current version, isPlaying, currentTime, duration, volume,
  isLoading, error, playbackRate, isMuted.
- Exposed actions: play, pause, togglePlayPause, seek, setVolume (clamped 0–1, unmutes),
  setPlaybackRate (clamped 0.25–2), toggleMute, loadSong, seekForward/seekBackward
  (±5 s via `UI_CONFIG.AUDIO_SEEK_STEP`).
  - **Unused in the actual UI**: togglePlayPause, toggleMute, setPlaybackRate,
    seekForward, seekBackward. There are no keyboard shortcuts anywhere.
- On track end: resets to time 0 and invokes a callback that advances the queue
  (`playNext`), which auto-plays the next song; at the end of the queue it stops and
  clears the current index.
- Play/pause is *doubly* tracked: the queue holds an `isPlaying` intent flag, the audio
  element emits real play/pause events, and two `useEffect`s in `App.tsx` reconcile the
  two. Loading a new song always lands in a paused state and relies on this
  reconciliation loop to start playback.

## Queue Engine (`useQueue`)

- In-memory only (lost on reload). Items are `{song, addedAt}`.
- `addToQueue` refuses songs whose processing isn't COMPLETED (silent `console.warn`
  aside from the toast in SongsView); first added song becomes current.
- `removeFromQueue`, `clearQueue`, `playNext`, `playPrevious`, `jumpToIndex`,
  `setIsPlaying`, `moveInQueue` (drag-and-drop support) with current-index bookkeeping.
- No shuffle, no repeat modes, no play-history beyond "items before current index",
  no duplicate prevention.

## Cover Art Handling

- Two independent mechanisms:
  1. `useCoverArtCache` + `useBatchCoverArtLoader` (Queue view): fetches cover art bytes
     per song via RPC, stores blob URLs in a Map keyed by song ID. The Queue view opts
     out of cleanup-on-unmount, so those object URLs are never revoked (leak by design
     to keep the cache warm, but the Map itself is still per-mount so it re-downloads on
     every visit anyway).
  2. Player view fetches its own copy directly with manual blob URL lifecycle.
- All cover art is assumed JPEG. Fallback is a placeholder image path
  (`/placeholder-album.png`) or a ♪ avatar glyph.

## API Client (`src/api/client.ts`)

- Connect transport with `credentials: 'include'` (supports reverse-proxy basic auth /
  cookies) and a 30 s abort-controller timeout on every request.
- Base URL from `VITE_API_BASE_URL` env var, defaulting to same-origin (`''`).
- Wrapper class `VoxStripAPI` over the generated client: `listSongs`, `getSong`,
  `deleteSong`, `importSongs` (converts Files to byte arrays), `downloadAudio`,
  `getCoverArt`, plus an unused `getCoverArtUrl` helper pointing at a REST-style path.
- Errors are normalized into an `APIError` carrying the Connect error code and message.
- **RPCs the UI never calls**: `GetSong` is wrapped but unused by any view.

## Configuration (`src/config.ts`)

- Page size default 10, options [10, 15, 50, 100].
- Audio seek step 5 s (unused in practice).
- Audio versions table (Original / Vocal / Instrumental / Karaoke) with enum mapping;
  default version `INSTRUMENTAL`.
- Status badge config and status predicate helpers (complete/processing/failed/pending).

## Dead Code & Known Quirks (worth not reproducing)

- `src/components/player/PlayerControls.tsx` and `PlayerDetails.tsx` are imported by
  nothing — leftovers from an earlier player layout (they include a download button and
  playback-rate slider that the live UI lacks).
- Full-library download on the Songs view defeats the server-side pagination the API
  provides.
- Full-file audio download before playback (no streaming, no `<audio src=url>` usage),
  re-downloaded on every version switch, losing playback position.
- No polling/refresh of processing status — a song imported as PENDING never visibly
  becomes COMPLETED without a manual Refresh on the Songs view.
- Partial import success keeps already-imported files staged, inviting duplicate imports.
- Queue/playback state, volume, and selected audio version are not persisted anywhere.
- The sidebar "Connected" indicator is fake.
- Cover art fetched twice via different mechanisms (queue cache vs. player), never
  shared, and queue-cache object URLs are never revoked.
- Removing the currently playing queue item jumps playback to queue position 0.
- Untimestamped lyric lines can never highlight; there's no fallback rendering for
  plain (non-LRC) lyrics as a scrollable block.
- Stray `console.log`/`console.warn`/`console.error` calls left in production paths.
