import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import SongsView from '../views/SongsView.js';
import QueueView from '../views/QueueView.js';
import PlayerView from '../views/PlayerView.js';
import ImportView from '../views/ImportView.js';
import App from '../App.js';

const rootRoute = createRootRoute({
  component: App,
});

const songsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SongsView,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/queue',
  component: QueueView,
});

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player',
  component: PlayerView,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/import',
  component: ImportView,
});

const routeTree = rootRoute.addChildren([
  songsRoute,
  queueRoute,
  playerRoute,
  importRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
