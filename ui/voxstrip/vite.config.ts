import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind plugin must precede the React plugin (Skeleton v5 requirement).
// The build lands in pkg/webui/dist so the Go binary can go:embed it. The
// .gitkeep placeholder there is restored by `make ui-build` after emptyOutDir
// wipes the directory, keeping a plain `go build` compilable.
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: './',
  build: {
    outDir: '../../pkg/webui/dist',
    emptyOutDir: true,
  },
});
