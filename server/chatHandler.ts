import Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Server-side chat proxy.
 *
 * This is the trust boundary: the Anthropic API key lives only here, in
 * `process.env`, and is never sent to the browser. The client POSTs the
 * conversation to `/api/chat`; this handler validates it, calls Claude with
 * streaming, and pipes the text deltas straight back to the client.
 *
 * The same handler runs in two places, sharing one implementation:
 *   - locally, as Vite dev-server middleware (see `vite.config.ts`);
 *   - in production, wrapped by `api/chat.ts` as a serverless function.
 *
 * Security posture (per the project policy):
 *   - Secret stays server-side; no key, PII, or stack traces reach the client.
 *   - Request body is size-capped and every field is validated/clamped.
 *   - Only POST is accepted; errors return generic messages.
 */

/** Hard cap on the request body to bound memory and abuse. */
const MAX_BODY_BYTES = 100_000;
/** Only the most recent messages are sent upstream (bounds token cost). */
const MAX_MESSAGES = 40;
/** Per-message content clamp. */
const MAX_CONTENT_LENGTH = 8_000;
/** Output cap — chat replies are short; keeps latency and cost low. */
const MAX_OUTPUT_TOKENS = 1_024;
/** Default model; override with the ANTHROPIC_MODEL env var. */
const DEFAULT_MODEL = 'claude-opus-4-8';

const SYSTEM_PROMPT = [
  'You are the Darwix assistant, a helpful and friendly AI inside a chat interface.',
  'Answer directly and concisely. Respond only with your final answer — do not include',
  'exploratory reasoning, intermediate drafts, or meta-commentary about your process.',
  'Prefer short paragraphs. Use Markdown for structure and fenced code blocks for code.',
].join(' ');

type Role = 'user' | 'assistant';
interface ApiMessage {
  role: Role;
  content: string;
}

type NodeReq = IncomingMessage & { body?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

/** Reads the raw request body, enforcing a size cap. Honours pre-parsed bodies. */
function readBody(req: NodeReq): Promise<string> {
  // Some runtimes (e.g. Vercel) may pre-parse the body onto `req.body`.
  if (req.body !== undefined && req.body !== null) {
    return Promise.resolve(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    );
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Validates, clamps, and normalises the incoming message list for the API. */
function normalizeMessages(raw: unknown): ApiMessage[] | null {
  if (!Array.isArray(raw)) return null;

  const out: ApiMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!isObject(item)) continue;
    const rawRole = item.role;
    const role: Role | null =
      rawRole === 'assistant' || rawRole === 'bot'
        ? 'assistant'
        : rawRole === 'user'
          ? 'user'
          : null;
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!role || content.length === 0) continue;
    out.push({ role, content: content.slice(0, MAX_CONTENT_LENGTH) });
  }

  // The Messages API requires the conversation to start with a user turn.
  while (out.length > 0 && out[0]!.role !== 'user') out.shift();

  return out.length > 0 ? out : null;
}

export async function handleChat(req: NodeReq, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Signal to the client that it should fall back to the offline simulator.
    sendJson(res, 503, { error: 'not_configured' });
    return;
  }

  let bodyText: string;
  try {
    bodyText = await readBody(req);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'payload_too_large';
    sendJson(res, tooLarge ? 413 : 400, { error: 'invalid_request' });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    sendJson(res, 400, { error: 'invalid_json' });
    return;
  }

  const messages = normalizeMessages(isObject(parsed) ? parsed.messages : undefined);
  if (!messages) {
    sendJson(res, 400, { error: 'invalid_messages' });
    return;
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  // Stream Claude's reply straight through to the client as plain-text deltas.
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    // Disabled for a snappy chat UX; the system prompt keeps replies final-answer-only.
    thinking: { type: 'disabled' },
    messages,
  });

  let aborted = false;
  req.on('close', () => {
    aborted = true;
    stream.abort();
  });

  // Headers are written lazily on the first token. This lets an *immediate*
  // upstream failure (bad key, rate limit, overload) be reported with a proper
  // error status the client can retry, instead of a silent empty 200.
  const beginStream = () => {
    if (res.headersSent) return;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      // Disable proxy buffering so tokens flush to the client immediately.
      'X-Accel-Buffering': 'no',
    });
  };

  try {
    stream.on('text', (delta: string) => {
      beginStream();
      res.write(delta);
    });
    await stream.finalMessage();
    beginStream(); // handles the (rare) empty-reply case
    res.end();
  } catch (error) {
    if (aborted) {
      try {
        res.end();
      } catch {
        /* socket already closed */
      }
      return;
    }
    // Log generically (no key, no PII); surface a generic error to the client.
    console.error(
      '[api/chat] upstream error:',
      error instanceof Error ? error.message : 'unknown',
    );
    if (!res.headersSent) {
      const status =
        error instanceof Anthropic.APIError && error.status && error.status < 500
          ? error.status
          : 502;
      sendJson(res, status, { error: 'upstream_error' });
    } else {
      try {
        res.end();
      } catch {
        /* socket already closed */
      }
    }
  }
}
