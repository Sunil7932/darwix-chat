import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleChat } from '../server/chatHandler.js';

/**
 * Serverless entry point for production deployments (e.g. Vercel).
 *
 * Body parsing is disabled so the handler can read the raw request stream and
 * enforce its own size cap. The actual logic lives in `server/chatHandler.ts`,
 * shared with the Vite dev middleware so local and production behave identically.
 */
export const config = {
  api: { bodyParser: false },
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleChat(req, res);
}
