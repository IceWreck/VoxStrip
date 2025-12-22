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
      to: '/songs',
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
          to="/songs"
          aria-label="VoxStrip - AI Karaoke System"
          className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-200-800 transition-colors"
          activeProps={{
            className: 'preset-filled-primary-100-900 text-primary-600-300',
          }}
        >
          <MusicIcon className="size-6 text-primary-500" />
          <span className="font-bold text-lg hidden md:block">VoxStrip</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.description}
                className="group w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all duration-200 hover:bg-surface-200-800 hover:translate-x-1"
                activeProps={{
                  className: 'preset-filled-primary bg-primary-500 text-primary-contrast-500 shadow-lg',
                }}
              >
                <Icon className="size-4 group-hover:scale-110 transition-transform" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-surface-200-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-xs opacity-60">Connected</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;