import { STATUS_BADGE_CONFIG } from '../config.js';
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
  // Get the enum key name as a string
  const statusKey = `PROCESSING_STATUS_${status === 0 ? 'UNSPECIFIED' : status === 1 ? 'PENDING' : status === 2 ? 'PROCESSING' : status === 3 ? 'COMPLETED' : status === 4 ? 'FAILED' : 'UNKNOWN'}`;
  const config = STATUS_BADGE_CONFIG[statusKey as keyof typeof STATUS_BADGE_CONFIG];
  
  if (!config) {
    // Fallback for unknown/unspecified statuses
    return (
      <span className={`badge preset-tonal-surface ${className}`}>
        {status === 0 ? 'Pending' : 'Unknown'}
      </span>
    );
  }

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