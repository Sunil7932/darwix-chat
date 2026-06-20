import { defineConfig, loadEnv, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { handleChat } from './server/chatHandler';

/**
 * Dev-only plugin that mounts the chat proxy at `/api/chat`, mirroring the
 * production serverless function (`api/chat.ts`). This lets `npm run dev`
 * serve real model responses without a separate backend process.
 */
function chatApiPlugin(): PluginOption {
  return {
    name: 'darwix-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', (req, res) => {
        void handleChat(req, res);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load `.env*` files (including non-`VITE_` keys) and expose the server-only
  // secret to the dev middleware via `process.env`. It is never bundled into
  // client code — only the proxy handler reads it.
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.GOOGLE_API_KEY) process.env.GOOGLE_API_KEY = env.GOOGLE_API_KEY;
  if (env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL;

  return {
    plugins: [react(), tailwindcss(), chatApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
