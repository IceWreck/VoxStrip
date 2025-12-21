import { useState, useCallback, useMemo } from 'react';
import type { Song } from '../api/client.js';

export interface QueueItem {
  song: Song;
  addedAt: Date;
}

export interface QueueState {
  items: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
}

export interface QueueActions {
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  jumpToIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
}

export function useQueue(): QueueState & QueueActions {
  const [state, setState] = useState<QueueState>({
    items: [],
    currentIndex: -1,
    isPlaying: false,
  });

  // Get current song (memoized)
  const currentSong = useMemo(() => {
    if (state.currentIndex >= 0 && state.currentIndex < state.items.length) {
      return state.items[state.currentIndex].song;
    }
    return null;
  }, [state.currentIndex, state.items]);

  // Add song to queue
  const addToQueue = useCallback((song: Song) => {
    setState(prevState => {
      const newItem: QueueItem = {
        song,
        addedAt: new Date(),
      };
      
      const newItems = [...prevState.items, newItem];
      
      // If queue was empty, set this as current song
      const newCurrentIndex = prevState.currentIndex === -1 ? 0 : prevState.currentIndex;
      
      return {
        ...prevState,
        items: newItems,
        currentIndex: newCurrentIndex,
      };
    });
  }, []);

  // Remove song from queue
  const removeFromQueue = useCallback((index: number) => {
    if (index < 0 || index >= state.items.length) return;

    setState(prevState => {
      const newItems = prevState.items.filter((_, i) => i !== index);
      
      // Adjust current index if necessary
      let newCurrentIndex = prevState.currentIndex;
      if (index === prevState.currentIndex) {
        // If removing current song, stop playing
        newCurrentIndex = newItems.length > 0 ? 0 : -1;
      } else if (index < prevState.currentIndex) {
        // If removing a song before current, adjust index
        newCurrentIndex = prevState.currentIndex - 1;
      } else if (prevState.currentIndex >= newItems.length) {
        // If current index is now out of bounds
        newCurrentIndex = newItems.length - 1;
      }
      
      return {
        ...prevState,
        items: newItems,
        currentIndex: newCurrentIndex,
        isPlaying: newCurrentIndex === -1 ? false : prevState.isPlaying,
      };
    });
  }, [state.items.length]);

  // Clear entire queue
  const clearQueue = useCallback(() => {
    setState({
      items: [],
      currentIndex: -1,
      isPlaying: false,
    });
  }, []);

  // Play next song
  const playNext = useCallback(() => {
    setState(prevState => {
      if (prevState.items.length === 0) return prevState;
      
      const nextIndex = prevState.currentIndex + 1;
      if (nextIndex >= prevState.items.length) {
        // End of queue
        return {
          ...prevState,
          currentIndex: -1,
          isPlaying: false,
        };
      }
      
      return {
        ...prevState,
        currentIndex: nextIndex,
        isPlaying: true,
      };
    });
  }, []);

  // Play previous song
  const playPrevious = useCallback(() => {
    setState(prevState => {
      if (prevState.items.length === 0 || prevState.currentIndex <= 0) {
        return prevState;
      }
      
      return {
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
        isPlaying: true,
      };
    });
  }, []);

  // Jump to specific index
  const jumpToIndex = useCallback((index: number) => {
    if (index < 0 || index >= state.items.length) return;
    
    setState(prevState => ({
      ...prevState,
      currentIndex: index,
      isPlaying: true,
    }));
  }, [state.items.length]);

  // Set playing state
  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prevState => ({
      ...prevState,
      isPlaying: playing,
    }));
  }, []);

  // Move item in queue (for drag-and-drop reordering)
  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= state.items.length ||
        toIndex < 0 || toIndex >= state.items.length ||
        fromIndex === toIndex) return;

    setState(prevState => {
      const newItems = [...prevState.items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      
      // Adjust current index if necessary
      let newCurrentIndex = prevState.currentIndex;
      if (fromIndex === prevState.currentIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < prevState.currentIndex && toIndex >= prevState.currentIndex) {
        newCurrentIndex = prevState.currentIndex - 1;
      } else if (fromIndex > prevState.currentIndex && toIndex <= prevState.currentIndex) {
        newCurrentIndex = prevState.currentIndex + 1;
      }
      
      return {
        ...prevState,
        items: newItems,
        currentIndex: newCurrentIndex,
      };
    });
  }, [state.items.length]);

  const result: QueueState & QueueActions = {
    ...state,
    currentSong,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    playPrevious,
    jumpToIndex,
    setIsPlaying,
    moveInQueue,
  };

  return result;
}