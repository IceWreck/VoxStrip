import { useState } from 'react';
import type { ViewKey } from './config.js';
import Sidebar from './components/Sidebar.js';
import SongsView from './views/SongsView.js';
import QueueView from './views/QueueView.js';
import PlayerView from './views/PlayerView.js';
import ImportView from './views/ImportView.js';
import { useQueue } from './hooks/useQueue.js';
import { useAudioPlayer } from './hooks/useAudioPlayer.js';

function App() {
  const [currentView, setCurrentView] = useState<ViewKey>('SONGS');
  const queue = useQueue();
  const audioPlayer = useAudioPlayer();

  // Sync queue with audio player
  const handleViewChange = (view: ViewKey) => {
    setCurrentView(view);
  };

  // Render current view based on selection
  const renderCurrentView = () => {
    switch (currentView) {
      case 'SONGS':
        return <SongsView queue={queue} />;
      case 'QUEUE':
        return <QueueView queue={queue} audioPlayer={audioPlayer} />;
      case 'PLAYER':
        return <PlayerView queue={queue} audioPlayer={audioPlayer} />;
      case 'IMPORT':
        return <ImportView />;
      default:
        return <SongsView queue={queue} />;
    }
  };

  return (
    <div className="h-screen grid grid-cols-[auto_1fr] overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
      />
      
      {/* Main Content Area */}
      <main className="overflow-auto bg-surface-50-950">
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderCurrentView()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;