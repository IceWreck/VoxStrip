import type { Song } from '../api/client.js';
import { formatDuration } from '../utils/formatters.js';
import { SearchIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useSongsLibrary } from '../hooks/useSongsLibrary.js';
import { useAppContext } from '../router/context.js';
import { UI_CONFIG } from '../config.js';
import StatusBadge from '../components/StatusBadge.js';
import { isProcessingComplete } from '../utils/statusHelpers.js';
import { toaster } from '../toaster.js';
import { VoxStripAPI } from '../api/client.js';
import { Dialog, Portal, Progress } from '@skeletonlabs/skeleton-react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { useState, useMemo, useCallback } from 'react';

export default function SongsView() {
  const { queue } = useAppContext();
  const {
    totalSize,
    loading,
    loadingProgress,
    error,
    searchTerm,
    setSearchTerm,
    filteredSongs,
    refresh,
    clearError,
  } = useSongsLibrary();

  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: UI_CONFIG.DEFAULT_PAGE_SIZE,
  });

  const handleAddToQueue = useCallback((song: Song) => {
    queue.addToQueue(song);

    toaster.success({
      title: "Added to Queue",
      description: `"${song.metadata?.title}" by ${song.metadata?.artist || 'Unknown Artist'}`
    });
  }, [queue]);

  const handleDelete = async () => {
    if (!songToDelete) return;

    try {
      await VoxStripAPI.deleteSong(songToDelete.songId);
      toaster.success({
        title: "Song Deleted",
        description: `"${songToDelete.metadata?.title}" removed from library`
      });
      refresh();
    } catch (error) {
      toaster.error({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setSongToDelete(null);
    }
  };

  const columns = useMemo<ColumnDef<Song>[]>(() => [
    {
      accessorKey: 'metadata.title',
      header: 'Title',
      cell: (info) => info.getValue() as string ?? 'Unknown Title',
    },
    {
      accessorKey: 'metadata.artist',
      header: 'Artist',
      cell: (info) => info.getValue() as string ?? 'Unknown Artist',
    },
    {
      accessorKey: 'metadata.album',
      header: 'Album',
      cell: (info) => info.getValue() as string ?? 'Unknown Album',
    },
    {
      accessorKey: 'durationMs',
      header: 'Duration',
      cell: (info) => formatDuration(Number(info.getValue())),
    },
    {
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.processingStatus} showIcon={false} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleAddToQueue(row.original)}
            disabled={!isProcessingComplete(row.original.processingStatus)}
            className="btn preset-outline flex items-center gap-1"
          >
            <PlusIcon size={14} />
            Add
          </button>
          <button
            onClick={() => setSongToDelete(row.original)}
            className="btn-icon preset-tonal"
            title="Delete song"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      ),
    },
  ], [handleAddToQueue]);

  const table = useReactTable({
    data: filteredSongs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="h2">Songs</h1>
          <p className="text-surface-600-400">
            {totalSize} {totalSize === 1 ? 'song' : 'songs'} in your library
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="btn preset-outline flex items-center gap-2"
          >
            <RefreshCwIcon size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <label className="flex-1 max-w-md">
          <span className="sr-only">Search songs</span>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400-600 size-4" />
            <input
              type="search"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </label>
      </div>

      {/* Error State */}
      {error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Error loading songs</p>
          <p className="text-sm opacity-80">{error}</p>
          <button onClick={clearError} className="btn preset-outline mt-2">
            Clear Error
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 space-y-4">
          <Progress value={loadingProgress} className="items-center w-fit mx-auto">
            <Progress.Circle>
              <Progress.CircleTrack />
              <Progress.CircleRange />
            </Progress.Circle>
            <Progress.ValueText />
          </Progress>
          <p className="text-sm text-surface-600-400">
            Loading songs library...
          </p>
        </div>
      )}

      {/* Songs Table */}
      {!loading && (
        <div className="table-wrap overflow-x-auto">
          <table className="table w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-surface-200-800">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="text-left p-3 font-medium">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-surface-100-900 hover:bg-surface-100-900 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {table.getRowModel().rows.length === 0 && (
            <div className="text-center py-12">
              <div className="text-surface-400-600 mb-2">
                {searchTerm ? 'No songs found matching your search' : 'No songs in your library'}
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="btn preset-outline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Client-side Pagination */}
      {filteredSongs.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-sm text-surface-600-400">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredSongs.length)} of{' '}
            {filteredSongs.length} entries
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="btn-icon preset-outline"
              title="First page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <ChevronLeftIcon className="w-4 h-4 -ml-3" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="btn-icon preset-outline"
              title="Previous page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-sm px-2">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="btn-icon preset-outline"
              title="Next page"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="btn-icon preset-outline"
              title="Last page"
            >
              <ChevronRightIcon className="w-4 h-4" />
              <ChevronRightIcon className="w-4 h-4 -ml-3" />
            </button>
            <label>
              <span className="sr-only">Page size</span>
              <select
                value={String(table.getState().pagination.pageSize)}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="select ml-4"
              >
                {UI_CONFIG.PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={String(size)}>
                    {size} per page
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={songToDelete !== null} onOpenChange={(details) => !details.open && setSongToDelete(null)}>
        <Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-surface-50-950/50" />
          <Dialog.Positioner className="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content className="card bg-surface-100-900 w-full max-w-md p-4 space-y-4 shadow-xl">
              <header className="flex justify-between items-center">
                <Dialog.Title className="text-lg font-bold">Delete Song</Dialog.Title>
                <Dialog.CloseTrigger className="btn-icon hover:preset-tonal">
                  <XIcon className="size-4" />
                </Dialog.CloseTrigger>
              </header>
              <Dialog.Description>
                Are you sure you want to delete "{songToDelete?.metadata?.title || 'this song'}"? This action cannot be undone.
              </Dialog.Description>
              <footer className="flex justify-end gap-2">
                <Dialog.CloseTrigger className="btn preset-tonal">Cancel</Dialog.CloseTrigger>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn preset-filled-error"
                >
                  Delete
                </button>
              </footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog>
    </div>
  );
}
