import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { SendHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (content: string) => void;
  /** Disables sending (e.g. while hydrating). */
  disabled?: boolean;
}

/** Maximum characters per message — guards against pathological input. */
const MAX_LENGTH = 4_000;
/** Cap the textarea growth so it never eats the whole screen. */
const MAX_TEXTAREA_HEIGHT = 200;

/**
 * Multi-line message composer.
 *
 * - Enter sends; Shift+Enter inserts a newline.
 * - Auto-grows with content up to a capped height, then scrolls internally.
 * - Re-focuses itself after a successful send for fast, uninterrupted typing.
 */
export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;
  const remaining = MAX_LENGTH - value.length;

  // Auto-resize the textarea to fit its content (bounded).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  // Focus the composer on mount for an immediately usable interface.
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
    // Return focus for rapid successive messages.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [canSend, onSend, trimmed]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter sends; Shift+Enter (or IME composition) inserts a newline.
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <form
      className="bg-surface/80 px-4 py-3 backdrop-blur-sm sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={clsx(
          'flex items-end gap-3 rounded-2xl bg-surface-raised p-2.5 ring-1 transition-colors',
          'ring-border-subtle focus-within:ring-2 focus-within:ring-accent',
        )}
      >
        <label htmlFor="chat-composer" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          aria-label="Message the assistant"
          aria-describedby="composer-hint"
          className={clsx(
            'scrollbar-slim max-h-[200px] min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2',
            'text-base leading-relaxed text-text-primary placeholder:text-text-muted',
            'focus:outline-none disabled:opacity-60',
          )}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className={clsx(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised',
            canSend
              ? 'bg-accent text-white hover:bg-accent-strong active:scale-95'
              : 'cursor-not-allowed bg-border-subtle text-text-muted',
          )}
        >
          <SendHorizontal size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-2">
        <p id="composer-hint" className="text-xs text-text-muted">
          Press <kbd className="font-sans font-semibold text-text-secondary">Enter</kbd> to
          send · <kbd className="font-sans font-semibold text-text-secondary">Shift + Enter</kbd>{' '}
          for a new line
        </p>
        {remaining <= 200 && (
          <span
            aria-live="polite"
            className={clsx(
              'text-xs tabular-nums',
              remaining <= 0 ? 'text-danger' : 'text-text-muted',
            )}
          >
            {remaining} left
          </span>
        )}
      </div>
    </form>
  );
}
