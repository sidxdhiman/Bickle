import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = '/bickle/';

// Vite's baseMiddleware 404s on "/bickle" (no trailing slash) instead of
// redirecting, which makes typing localhost:5173/bickle look like a broken
// server. Registered synchronously inside configureServer, this runs BEFORE
// Vite's internal base middleware and 302s to the correct URL first.
const baseSlashRedirect = (base) => {
  const baseNoSlash = base.replace(/\/$/, '');
  const middleware = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const url = req.url || '';
    const pathname = url.split('?')[0];
    if (pathname !== baseNoSlash) return next();
    res.statusCode = 302;
    res.setHeader('Location', `${base}${url.slice(pathname.length)}`);
    res.end();
  };

  return {
    name: 'bickle-base-slash-redirect',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};

export default defineConfig({
  base: BASE,
  plugins: [react(), baseSlashRedirect(BASE)],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/bickle/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bickle\/api/, '/api'),
      },
    },
  },
});
