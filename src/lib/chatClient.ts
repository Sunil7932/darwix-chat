import type { Message } from '@/types/chat';

/**
 * Client for the server-side chat proxy (`/api/chat`).
 *
 * Streams the assistant's reply as plain-text deltas and invokes callbacks as
 * tokens arrive, so the UI can render the response progressively. The API key
 * never touches this code — it lives only on the server.
 */

/** Thrown when the server has no API key configured (triggers offline fallback). */
export class ChatNotConfiguredError extends Error {
  constructor() {
    super('The chat backend is not configured.');
    this.name = 'ChatNotConfiguredError';
  }
}

interface StreamHandlers {
  /** Abort signal to cancel the in-flight request. */
  signal: AbortSignal;
  /** Called once the server has accepted the request (before the first token). */
  onOpen?: () => void;
  /** Called for each streamed text delta. */
  onToken?: (delta: string) => void;
}

/** Maps internal messages to the `{ role, content }` shape the proxy expects. */
function toApiMessages(messages: Message[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({
    role: m.role === 'bot' ? 'assistant' : 'user',
    content: m.content,
  }));
}

/**
 * Sends the conversation to the proxy and streams back the reply.
 * Resolves with the full reply text; rejects on transport/upstream errors
 * (or {@link ChatNotConfiguredError} when no backend key is configured).
 */
export async function streamChatReply(
  history: Message[],
  { signal, onOpen, onToken }: StreamHandlers,
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: toApiMessages(history) }),
    signal,
  });

  if (!response.ok || !response.body) {
    if (response.status === 503 || response.status === 404) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 404 || payload?.error === 'not_configured') {
        throw new ChatNotConfiguredError();
      }
    }
    if (response.status === 429) {
      throw new Error('Rate limit reached — please wait a moment and try again.');
    }
    throw new Error(`The assistant could not respond (status ${response.status}).`);
  }

  onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onToken?.(chunk);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return full;
}
