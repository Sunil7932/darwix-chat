/**
 * Offline fallback bot.
 *
 * Used only when the server has no Gemini API key configured (so the app
 * still runs end-to-end out of the box). When a key *is* present, real model
 * responses stream in via `@/lib/chatClient` instead and this module is unused.
 */

const FALLBACK_REPLIES: readonly string[] = [
  "I’m running in offline demo mode right now (no API key configured), so I can’t give a real answer — but the chat UI, streaming, retry and persistence all work. Add a GEMINI_API_KEY to get live responses.",
  'Offline demo mode: connect a Google Gemini API key on the server to get real answers. Everything else — typing indicator, auto-scroll, history — is fully functional.',
  'This is a simulated reply (no API key set). With a key configured, I’d answer your question for real and stream the response token by token.',
];

/** Returns a random integer in the inclusive range [min, max]. */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Resolves after `ms`, but rejects early if the provided signal aborts. */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** How long the fallback bot "thinks" (typing indicator visible) before replying. */
export function getTypingDuration(): number {
  return randomInt(700, 1500);
}

/** Produces a canned fallback reply. */
export function generateReply(): string {
  const index = randomInt(0, FALLBACK_REPLIES.length - 1);
  return FALLBACK_REPLIES[index] ?? FALLBACK_REPLIES[0]!;
}
