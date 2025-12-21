import { Outlet } from '@tanstack/react-router';
import Sidebar from './components/Sidebar.js';
import { useQueue } from './hooks/useQueue.js';
import { useAudioPlayer } from './hooks/useAudioPlayer.js';
import { AppContext } from './router/context.js';

function App() {
  const queue = useQueue();
  const audioPlayer = useAudioPlayer();

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
    </AppContext.Provider>
  );
}

export default App;