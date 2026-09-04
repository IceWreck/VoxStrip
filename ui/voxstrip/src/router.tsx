import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import AppShell from './components/AppShell';
import SongsView from './views/SongsView';
import QueueView from './views/QueueView';
import PlayerView from './views/PlayerView';
import ImportView from './views/ImportView';
import StageView from './views/StageView';

const rootRoute = createRootRoute();

// All library routes share the app shell (sidebar, mini player, player
// context). The stage display sits outside it: a bare window with no audio.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/songs' });
  },
});

const songsRoute = createRoute({ getParentRoute: () => shellRoute, path: '/songs', component: SongsView });
const queueRoute = createRoute({ getParentRoute: () => shellRoute, path: '/queue', component: QueueView });
const playerRoute = createRoute({ getParentRoute: () => shellRoute, path: '/player', component: PlayerView });
const importRoute = createRoute({ getParentRoute: () => shellRoute, path: '/import', component: ImportView });

const stageRoute = createRoute({ getParentRoute: () => rootRoute, path: '/stage', component: StageView });

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([indexRoute, songsRoute, queueRoute, playerRoute, importRoute]),
  stageRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
