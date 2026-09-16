import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { detectChordsDevPlugin } from './vite/detectChordsPlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), detectChordsDevPlugin(env.OPENROUTER_API_KEY || '')],
    optimizeDeps: {
      exclude: ['sharp', 'onnxruntime-web'],
    },
    build: {
      rollupOptions: {
        external: ['sharp'],
      },
    },
  };
});
