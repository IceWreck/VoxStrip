import { 
  MusicIcon, 
  ListIcon, 
  PlayIcon, 
  UploadIcon 
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function Sidebar() {
  const navigationItems = [
    {
      to: '/',
      label: 'Songs',
      icon: MusicIcon,
      description: 'Browse your music library',
    },
    {
      to: '/queue',
      label: 'Queue',
      icon: ListIcon,
      description: 'Manage your queue',
    },
    {
      to: '/player',
      label: 'Player',
      icon: PlayIcon,
      description: 'Now playing',
    },
    {
      to: '/import',
      label: 'Import',
      icon: UploadIcon,
      description: 'Add new music',
    },
  ];

  return (
    <aside className="grid grid-rows-[auto_1fr_auto] gap-4 h-screen sticky top-0 w-64 bg-surface-50-950 border-r border-surface-200-800">
      {/* Header */}
      <div className="p-4">
        <Link
          to="/"
          aria-label="VoxStrip - AI Karaoke System"
          className="flex items-center gap-2 hover:preset-tonal-surface p-2 rounded transition-colors"
          activeProps={{
            className: 'preset-filled-primary-100-900 text-primary-600-300',
          }}
        >
          <MusicIcon className="size-6 text-primary-500" />
          <span className="font-bold text-lg hidden md:block">VoxStrip</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.description}
                className="w-full text-left p-3 rounded flex items-center gap-3 transition-colors hover:preset-tonal-surface"
                activeProps={{
                  className: 'preset-filled-primary-100-900 text-primary-600-300',
                }}
              >
                <Icon className="size-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
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