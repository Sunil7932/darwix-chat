/**
 * Bot + network simulation.
 *
 * This stands in for a real backend so the UI can demonstrate the full message
 * lifecycle — optimistic send, delivery failure + retry, typing indicator and
 * an asynchronous bot reply — without any server. All timings are randomised
 * within sensible bounds to feel natural.
 */

/** Probability that an outbound user message "fails" to deliver (for retry UX). */
const FAILURE_RATE = 0.18;

const REPLIES: readonly string[] = [
  "Great question! Let me walk you through it step by step so it's easy to follow.",
  "Here's a concise summary of what you asked about, along with a couple of practical tips.",
  'I can help with that. Could you share a little more detail so I can tailor the answer?',
  'Absolutely — that approach works well. One thing to keep in mind is edge cases at scale.',
  "Good thinking. There are a few trade-offs worth weighing before you commit to a direction.",
  'Done! I’ve put together a clear explanation. Let me know if you’d like me to go deeper.',
  'That’s a common scenario. The recommended pattern is to validate input early and fail fast.',
  'Happy to help. In short: keep it simple, measure first, then optimise the hot paths.',
  'Interesting! Performance-wise, virtualising long lists keeps things smooth even with thousands of items.',
  'Sure thing. Accessibility-wise, make sure every interactive element is reachable by keyboard.',
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

/**
 * Simulates delivering a user message to the server.
 * Resolves on success; rejects with an `Error` to model a delivery failure.
 */
export async function simulateDelivery(signal?: AbortSignal): Promise<void> {
  await delay(randomInt(350, 900), signal);
  if (Math.random() < FAILURE_RATE) {
    throw new Error('Message failed to send. Check your connection and try again.');
  }
}

/** How long the bot "thinks" (typing indicator visible) before replying. */
export function getTypingDuration(): number {
  return randomInt(900, 2200);
}

/** Produces a deterministic-enough but varied bot reply for a given prompt. */
export function generateReply(prompt: string): string {
  const trimmed = prompt.trim();
  const index = randomInt(0, REPLIES.length - 1);
  const base = REPLIES[index] ?? REPLIES[0]!;

  // Occasionally echo a snippet of the prompt to feel contextual.
  if (trimmed.length > 0 && Math.random() < 0.4) {
    const snippet = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
    return `You said: “${snippet}”.\n\n${base}`;
  }
  return base;
}
