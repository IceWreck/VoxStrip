import { Link } from '@tanstack/react-router';
import { ListMusicIcon, MicVocalIcon, MusicIcon, PlayIcon, UploadIcon } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/songs', label: 'Songs', Icon: MusicIcon },
  { to: '/queue', label: 'Queue', Icon: ListMusicIcon },
  { to: '/player', label: 'Player', Icon: PlayIcon },
  { to: '/import', label: 'Import', Icon: UploadIcon },
] as const;

export default function Sidebar() {
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-surface-200-800 bg-surface-50-950 md:w-56">
      <Link to="/songs" className="flex items-center gap-2 p-4" aria-label="VoxStrip home">
        <MicVocalIcon className="size-6 shrink-0 text-primary-500" />
        <span className="hidden bg-linear-to-r from-primary-400 to-secondary-400 bg-clip-text text-lg font-bold text-transparent md:block">VoxStrip</span>
      </Link>

      <nav className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-base p-3 transition-colors hover:bg-surface-200-800"
            activeProps={{ className: 'bg-linear-to-r from-primary-500 to-secondary-600 text-primary-contrast-500 shadow-lg' }}
            aria-label={label}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden font-medium md:block">{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
