import { createContext, useContext } from 'react';
import { useQueue } from '../hooks/useQueue';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

export type AppContextType = {
  queue: ReturnType<typeof useQueue>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
};

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
