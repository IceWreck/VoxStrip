import { Dialog, Portal } from '@skeletonlabs/skeleton-react';
import { XIcon } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

// ConfirmDialog asks for confirmation before a destructive action.
export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-surface-50-950/60 backdrop-blur-sm" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="card bg-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-xl">
            <header className="flex items-center justify-between">
              <Dialog.Title className="h4">{title}</Dialog.Title>
              <Dialog.CloseTrigger className="btn-icon hover:preset-tonal">
                <XIcon className="size-4" />
              </Dialog.CloseTrigger>
            </header>
            <Dialog.Description className="text-surface-600-400">{message}</Dialog.Description>
            <footer className="flex justify-end gap-2">
              <Dialog.CloseTrigger className="btn preset-tonal">Cancel</Dialog.CloseTrigger>
              <button type="button" onClick={onConfirm} className="btn preset-filled-error-500">
                {confirmLabel}
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog>
  );
}
