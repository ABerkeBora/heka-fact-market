import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3102,
    strictPort: true,
    hmr: {port: 23102},
    fs: {
      strict: true,
      allow: [process.cwd()],
      deny: [
        '**/.local/**',
        '**/test-wallets.json',
        '**/.env*',
        '**/.git/**',
        '**/*.{crt,pem,key}',
        '**/.svn/**',
        '**/.hg/**',
      ],
    },
  },
  build: { outDir: 'dist' },
});
