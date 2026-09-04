import { CheckIcon, ClockIcon, Loader2Icon, XIcon } from 'lucide-react';
import { ProcessingStatus } from '../api/client';

const STATUS_CONFIG: Record<ProcessingStatus, { classes: string; label: string; Icon: typeof CheckIcon; spin?: boolean }> = {
  [ProcessingStatus.UNSPECIFIED]: { classes: 'preset-tonal-surface', label: 'Pending', Icon: ClockIcon },
  [ProcessingStatus.PENDING]: { classes: 'preset-tonal-surface', label: 'Pending', Icon: ClockIcon },
  [ProcessingStatus.PROCESSING]: { classes: 'preset-tonal-warning', label: 'Processing', Icon: Loader2Icon, spin: true },
  [ProcessingStatus.COMPLETED]: { classes: 'preset-tonal-success', label: 'Ready', Icon: CheckIcon },
  [ProcessingStatus.FAILED]: { classes: 'preset-tonal-error', label: 'Failed', Icon: XIcon },
};

export default function StatusBadge({ status }: { status: ProcessingStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[ProcessingStatus.UNSPECIFIED];
  return (
    <span className={`badge ${config.classes}`}>
      <config.Icon size={12} className={config.spin ? 'animate-spin' : ''} />
      {config.label}
    </span>
  );
}
