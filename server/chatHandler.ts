import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Server-side chat proxy (Google Gemini).
 *
 * This is the trust boundary: the Gemini API key lives only here, in
 * `process.env`, and is never sent to the browser. The client POSTs the
 * conversation to `/api/chat`; this handler validates it, calls Gemini with
 * streaming (SSE), and pipes the text deltas straight back to the client.
 *
 * Gemini's free tier (https://aistudio.google.com — no credit card) makes this
 * a zero-cost backend. The handler is provider-agnostic from the client's point
 * of view: swapping providers only touches this file.
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
/** Default model; override with the GEMINI_MODEL env var. Free-tier friendly. */
const DEFAULT_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = [
  'You are the Darwix assistant, a helpful and friendly AI inside a chat interface.',
  'Answer directly and concisely. Prefer short paragraphs.',
  'Use Markdown for structure and fenced code blocks for code.',
].join(' ');

type Role = 'user' | 'model';
interface GeminiContent {
  role: Role;
  parts: Array<{ text: string }>;
}

type NodeReq = IncomingMessage & { body?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
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

/**
 * Validates, clamps, and maps the incoming messages to Gemini's `contents`
 * format (roles are `user` / `model`, content is wrapped in `parts`).
 */
function normalizeMessages(raw: unknown): GeminiContent[] | null {
  if (!Array.isArray(raw)) return null;

  const out: GeminiContent[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!isObject(item)) continue;
    const rawRole = item.role;
    const role: Role | null =
      rawRole === 'model' || rawRole === 'assistant' || rawRole === 'bot'
        ? 'model'
        : rawRole === 'user'
          ? 'user'
          : null;
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!role || content.length === 0) continue;
    out.push({ role, parts: [{ text: content.slice(0, MAX_CONTENT_LENGTH) }] });
  }

  // Gemini expects the conversation to start with a user turn.
  while (out.length > 0 && out[0]!.role !== 'user') out.shift();

  return out.length > 0 ? out : null;
}

/** Extracts the incremental text from one Gemini SSE chunk. */
function extractDelta(chunk: unknown): string {
  if (!isObject(chunk)) return '';
  const candidates = chunk.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const first = candidates[0];
  if (!isObject(first) || !isObject(first.content)) return '';
  const parts = first.content.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (isObject(p) && typeof p.text === 'string' ? p.text : ''))
    .join('');
}

export async function handleChat(req: NodeReq, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const apiKey = getApiKey();
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

  const contents = normalizeMessages(isObject(parsed) ? parsed.messages : undefined);
  if (!contents) {
    sendJson(res, 400, { error: 'invalid_messages' });
    return;
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse`;

  // Abort the upstream request if the client disconnects.
  const controller = new AbortController();
  let aborted = false;
  req.on('close', () => {
    aborted = true;
    controller.abort();
  });

  // Headers are written lazily on the first token so an immediate upstream
  // failure (bad key, quota) can be reported with a retryable status instead
  // of a silent empty 200.
  const beginStream = () => {
    if (res.headersSent) return;
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Key travels in a header, never in the URL or any log line.
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      // Don't forward upstream error bodies (may contain provider internals).
      const status = upstream.status >= 500 ? 502 : upstream.status === 429 ? 429 : 502;
      console.error('[api/chat] upstream status:', upstream.status);
      sendJson(res, status, { error: 'upstream_error' });
      return;
    }

    // Parse the Server-Sent Events stream and forward text deltas as plain text.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data.length === 0 || data === '[DONE]') continue;
        try {
          const delta = extractDelta(JSON.parse(data));
          if (delta) {
            beginStream();
            res.write(delta);
          }
        } catch {
          // Ignore partial/non-JSON keep-alive lines.
        }
      }
    }

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
      '[api/chat] error:',
      error instanceof Error ? error.message : 'unknown',
    );
    if (!res.headersSent) {
      sendJson(res, 502, { error: 'upstream_error' });
    } else {
      try {
        res.end();
      } catch {
        /* socket already closed */
      }
    }
  }
}
