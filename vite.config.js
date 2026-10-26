import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@react-three/drei')) return 'three-drei';
          if (id.includes('@react-three/fiber')) return 'three-fiber';
          if (id.includes('/node_modules/three/')) return 'three-core';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('katex')) return 'math';
          return undefined;
        },
      },
    },
  },
});
