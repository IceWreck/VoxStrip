import { createToaster } from '@skeletonlabs/skeleton-react';

// Singleton toaster rendered by the app shell's Toast.Group.
export const toaster = createToaster({ placement: 'bottom-end' });
