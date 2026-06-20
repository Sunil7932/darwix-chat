import { Avatar } from '@/components/chat/Avatar';

/**
 * Animated "assistant is typing" indicator. Marked `aria-hidden` because the
 * typing state is announced separately through a polite live region (see
 * `AriaAnnouncer`), avoiding noisy or duplicated screen-reader output.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 px-4 py-2 sm:px-6" aria-hidden="true">
      <Avatar role="bot" />
      <div className="flex items-center gap-1.5 rounded-bubble rounded-bl-sm bg-bot-bubble px-4 py-3 ring-1 ring-border-subtle">
        <span className="sr-only">Assistant is typing</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-text-secondary [animation:var(--animate-typing-bounce)]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
