import { getStatusBadgeConfig } from '../utils/statusHelpers.js';
import type { ProcessingStatus } from '../api/client.js';
import { Clock, Loader2, Check, X } from 'lucide-react';

// Icon mapping
const iconMap = {
  Clock,
  Loader2,
  Check,
  X,
} as const;

interface StatusBadgeProps {
  status: ProcessingStatus;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className = '', showIcon = true }: StatusBadgeProps) {
  const config = getStatusBadgeConfig(status);
  const IconComponent = iconMap[config.icon as keyof typeof iconMap];

  return (
    <span className={`${config.preset} badge flex items-center gap-1 ${className}`}>
      {showIcon && IconComponent && (
        <IconComponent size={12} className={config.icon === 'Loader2' ? 'animate-spin' : ''} />
      )}
      {config.text}
    </span>
  );
}

export default StatusBadge;