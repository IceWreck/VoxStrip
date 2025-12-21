import { 
  MusicIcon, 
  ListIcon, 
  PlayIcon, 
  UploadIcon 
} from 'lucide-react';
import { VIEWS, type ViewKey } from '../config.js';

interface SidebarProps {
  currentView: ViewKey;
  onViewChange: (view: ViewKey) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navigationItems = [
    {
      key: VIEWS.SONGS,
      label: 'Songs',
      icon: MusicIcon,
      description: 'Browse your music library',
    },
    {
      key: VIEWS.QUEUE,
      label: 'Queue',
      icon: ListIcon,
      description: 'Manage your queue',
    },
    {
      key: VIEWS.PLAYER,
      label: 'Player',
      icon: PlayIcon,
      description: 'Now playing',
    },
    {
      key: VIEWS.IMPORT,
      label: 'Import',
      icon: UploadIcon,
      description: 'Add new music',
    },
  ];

  return (
    <aside className="grid grid-rows-[auto_1fr_auto] gap-4 h-screen sticky top-0 w-64 bg-surface-50-950 border-r border-surface-200-800">
      {/* Header */}
      <div className="p-4">
        <button
          type="button"
          onClick={() => onViewChange(VIEWS.SONGS)}
          title="VoxStrip - AI Karaoke System" 
          aria-label="VoxStrip - AI Karaoke System"
          className="flex items-center gap-2 hover:preset-tonal-surface p-2 rounded transition-colors"
        >
          <MusicIcon className="size-6 text-primary-500" />
          <span className="font-bold text-lg hidden md:block">VoxStrip</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.key;
            
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => onViewChange(item.key)}
                title={item.description}
                aria-label={item.description}
                className={`w-full text-left p-3 rounded flex items-center gap-3 transition-colors ${
                  isActive 
                    ? 'preset-filled-primary-100-900 text-primary-600-300' 
                    : 'hover:preset-tonal-surface'
                }`}
              >
                <Icon className="size-4" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-xs opacity-60">Connected</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;