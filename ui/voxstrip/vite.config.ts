import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind plugin must precede the React plugin (Skeleton v5 requirement).
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: './',
});
