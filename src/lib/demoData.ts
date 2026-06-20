import type { Message } from '@/types/chat';
import { createId } from '@/lib/id';

/**
 * Generates a large, realistic conversation for demonstrating that the list
 * stays smooth under load (virtualisation). Messages are back-dated so the
 * timeline reads naturally from oldest to newest.
 */
const USER_LINES: readonly string[] = [
  'Hey, can you explain how virtualised lists work?',
  'What about accessibility — how do I keep it screen-reader friendly?',
  'Nice. And how should I handle thousands of messages?',
  'Can you give me a quick example?',
  'What are the main performance pitfalls to avoid?',
  'How do I keep auto-scroll from fighting the user?',
  'Thanks, that makes sense!',
  'One more thing — how do I persist the conversation?',
  'Could you summarise the key takeaways?',
  'Perfect, that’s exactly what I needed.',
];

const BOT_LINES: readonly string[] = [
  'Virtualised lists only render the rows currently in view (plus a small overscan buffer), so the DOM stays tiny no matter how long the conversation grows.',
  'Use semantic roles like `log` for the transcript, give each message group an accessible label, and ensure every control is reachable and operable by keyboard.',
  'Measure each row’s real height, recycle nodes as you scroll, and avoid re-rendering the whole list when a single message changes — memoise the row component.',
  'Sure! Render a fixed-height window, translate rows into place with transforms, and only mount what’s visible. The rest is virtual space.',
  'Watch for layout thrashing, unkeyed lists, heavy work in render, and synchronous storage writes on every keystroke — debounce those.',
  'Track whether the viewport is pinned to the bottom. Only auto-scroll when it already is; otherwise show a “jump to latest” affordance instead.',
  'You’re welcome — glad it helped!',
  'Serialise messages to storage (debounced), validate them strictly on load, and restore them into state when the app boots.',
  'Render only what’s visible, keep rows memoised, persist safely, and never let auto-scroll override a user who is reading history.',
  'Happy to help. Ping me anytime you want to go deeper on any of these.',
];

export function createDemoMessages(count = 1_000): Message[] {
  const messages: Message[] = [];
  const now = Date.now();
  // Space messages ~30s apart, oldest first.
  const stepMs = 30_000;
  const startAt = now - count * stepMs;

  for (let i = 0; i < count; i += 1) {
    const isUser = i % 2 === 0;
    const pool = isUser ? USER_LINES : BOT_LINES;
    const line = pool[Math.floor(i / 2) % pool.length] ?? pool[0]!;

    messages.push({
      id: createId(),
      role: isUser ? 'user' : 'bot',
      content: `${line}`,
      createdAt: startAt + i * stepMs,
      status: 'sent',
    });
  }

  return messages;
}
