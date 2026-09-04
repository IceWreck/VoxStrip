import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Progress } from '@skeletonlabs/skeleton-react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListPlusIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { ProcessingStatus, errorMessage, type Song } from '../api/client';
import { useDeleteSong, useSongs, useUpdateSong } from '../queries/songs';
import { usePlayer } from '../player/store';
import { formatDuration } from '../lib/format';
import { toaster } from '../toaster';
import CoverArt from '../components/CoverArt';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import MetadataDialog, { type SongMetadataFields } from '../components/MetadataDialog';

const PAGE_SIZES = [15, 50, 100];

function matchesSearch(song: Song, term: string): boolean {
  const metadata = song.metadata;
  if (!metadata) return false;
  return [metadata.title, metadata.artist, metadata.album, metadata.genre].some((field) =>
    field?.toLowerCase().includes(term),
  );
}

function SortableHeader({ label, column }: { label: string; column: { getToggleSortingHandler: () => ((event: unknown) => void) | undefined; getIsSorted: () => false | 'asc' | 'desc' } }) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      className="flex select-none items-center gap-1 font-medium"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'asc' && <ArrowUpIcon size={14} />}
      {sorted === 'desc' && <ArrowDownIcon size={14} />}
    </button>
  );
}

export default function SongsView() {
  const { data: songs, isLoading, error, refetch, isRefetching } = useSongs();
  const deleteSong = useDeleteSong();
  const updateSong = useUpdateSong();
  const player = usePlayer();

  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);

  const filteredSongs = useMemo(() => {
    const all = songs ?? [];
    const term = searchTerm.trim().toLowerCase();
    return term ? all.filter((song) => matchesSearch(song, term)) : all;
  }, [songs, searchTerm]);

  const columns = useMemo<ColumnDef<Song>[]>(
    () => [
      {
        id: 'cover',
        header: '',
        // min-w counters the browser's max-width:100% img default, which
        // would otherwise crush the thumbnail when other columns are wide.
        cell: ({ row }) => (
          <CoverArt
            key={row.original.songId}
            songId={row.original.songId}
            alt=""
            className="size-10 min-w-10 rounded-base"
          />
        ),
      },
      {
        id: 'title',
        accessorFn: (song) => song.metadata?.title || 'Unknown Title',
        header: ({ column }) => <SortableHeader label="Title" column={column} />,
        cell: (info) => (
          <div className="line-clamp-2 max-w-72 font-medium" title={info.getValue<string>()}>
            {info.getValue<string>()}
          </div>
        ),
      },
      {
        id: 'artist',
        accessorFn: (song) => song.metadata?.artist || 'Unknown Artist',
        header: ({ column }) => <SortableHeader label="Artist" column={column} />,
        cell: (info) => (
          <div className="line-clamp-2 max-w-64" title={info.getValue<string>()}>
            {info.getValue<string>()}
          </div>
        ),
      },
      {
        id: 'album',
        accessorFn: (song) => song.metadata?.album || '',
        header: ({ column }) => <SortableHeader label="Album" column={column} />,
        cell: (info) => (
          <div className="line-clamp-2 max-w-56" title={info.getValue<string>()}>
            {info.getValue<string>()}
          </div>
        ),
      },
      {
        id: 'duration',
        accessorFn: (song) => Number(song.durationMs),
        header: ({ column }) => <SortableHeader label="Duration" column={column} />,
        cell: (info) => (
          <span className="whitespace-nowrap font-mono text-sm">{formatDuration(info.getValue<number>())}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.processingStatus} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const song = row.original;
          const ready = song.processingStatus === ProcessingStatus.COMPLETED;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => player.playNow(song)}
                disabled={!ready}
                className="btn-icon btn-icon-sm hover:preset-tonal disabled:opacity-30"
                title="Play now"
              >
                <PlayIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  player.addToQueue(song);
                  toaster.success({
                    title: 'Added to queue',
                    description: `${song.metadata?.title || 'Unknown Title'} — ${song.metadata?.artist || 'Unknown Artist'}`,
                  });
                }}
                disabled={!ready}
                className="btn-icon btn-icon-sm hover:preset-tonal disabled:opacity-30"
                title="Add to queue"
              >
                <ListPlusIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setSongToEdit(song)}
                className="btn-icon btn-icon-sm hover:preset-tonal"
                title="Edit metadata"
              >
                <PencilIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setSongToDelete(song)}
                className="btn-icon btn-icon-sm hover:preset-tonal-error"
                title="Delete song"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          );
        },
      },
    ],
    [player],
  );

  const table = useReactTable({
    data: filteredSongs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize: PAGE_SIZES[0] } },
    autoResetPageIndex: false,
  });

  const handleDelete = async () => {
    if (!songToDelete) return;
    const song = songToDelete;
    setSongToDelete(null);
    try {
      await deleteSong.mutateAsync(song.songId);
      toaster.success({ title: 'Song deleted', description: song.metadata?.title || song.songId });
    } catch (err) {
      toaster.error({ title: 'Delete failed', description: errorMessage(err) });
    }
  };

  const handleSaveMetadata = async (fields: SongMetadataFields) => {
    if (!songToEdit) return;
    try {
      await updateSong.mutateAsync({
        songId: songToEdit.songId,
        // Send every field so cleared inputs clear the stored value.
        title: fields.title ?? '',
        artist: fields.artist ?? '',
        album: fields.album ?? '',
        albumArtist: fields.albumArtist ?? '',
        genre: fields.genre ?? '',
        lyrics: fields.lyrics ?? '',
      });
      setSongToEdit(null);
      toaster.success({ title: 'Metadata saved', description: fields.title || songToEdit.songId });
    } catch (err) {
      toaster.error({ title: 'Save failed', description: errorMessage(err) });
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h2">Songs</h1>
          <p className="text-surface-600-400">
            {songs?.length ?? 0} {songs?.length === 1 ? 'song' : 'songs'} in your library
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn preset-outlined-surface-200-800"
        >
          <RefreshCwIcon size={16} className={isRefetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <label className="relative block max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-600-400" />
        <input
          type="search"
          placeholder="Search title, artist, album, genre…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            table.setPageIndex(0);
          }}
          className="input pl-10"
        />
      </label>

      {error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Failed to load songs</p>
          <p className="text-sm opacity-80">{errorMessage(error)}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Progress value={null} className="w-64">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="text-left">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-surface-200-800">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-100-900">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSongs.length === 0 && (
              <div className="py-16 text-center text-surface-600-400">
                {searchTerm ? 'No songs match your search.' : 'Your library is empty — import some songs to get started.'}
              </div>
            )}
          </div>

          {filteredSongs.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm text-surface-600-400">
                Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)} ·{' '}
                {filteredSongs.length} songs
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="btn-icon preset-outlined-surface-200-800"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="btn-icon preset-outlined-surface-200-800"
                  aria-label="Next page"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="select w-fit"
                  aria-label="Page size"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={songToDelete !== null}
        title="Delete Song"
        message={`Delete "${songToDelete?.metadata?.title || 'this song'}"? The audio files and generated stems are removed permanently.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setSongToDelete(null)}
      />

      {songToEdit && (
        <MetadataDialog
          open
          heading="Edit Metadata"
          subheading={songToEdit.metadata?.title || songToEdit.songId}
          initial={{
            title: songToEdit.metadata?.title,
            artist: songToEdit.metadata?.artist,
            album: songToEdit.metadata?.album,
            albumArtist: songToEdit.metadata?.albumArtist,
            genre: songToEdit.metadata?.genre,
            lyrics: songToEdit.metadata?.lyrics,
          }}
          busy={updateSong.isPending}
          onSave={handleSaveMetadata}
          onClose={() => setSongToEdit(null)}
        />
      )}
    </div>
  );
}
