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
      rollupOptions: {
        // Externalizar módulos opcionales que pueden no estar instalados
        external: (id) => {
          // Solo externalizar si realmente no queremos incluirlo
          // En este caso, mejor manejarlo en runtime
          return false;
        },
      },
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
    optimizeDeps: {
      // Excluir Sentry de la optimización si no está instalado
      exclude: ['@sentry/react'],
    },
  };
});
