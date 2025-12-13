import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscator from 'rollup-plugin-obfuscator';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Carga las variables de entorno según el modo (`development` o `production`)
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: '/',
    build: {
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL, // usa la variable del .env
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
