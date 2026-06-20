import { memo } from 'react';
import { AlertCircle, Check, Clock, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';
import type { Message } from '@/types/chat';
import { Avatar } from '@/components/chat/Avatar';
import { MessageTimestamp } from '@/components/chat/MessageTimestamp';

interface MessageBubbleProps {
  message: Message;
  onRetry: (id: string) => void;
}

/** Compact, per-status delivery indicator for the user's own messages. */
function DeliveryStatus({ status }: { status: Message['status'] }) {
  if (status === 'sending') {
    return (
      <span className="inline-flex items-center gap-1 text-text-muted">
        <Clock size={12} aria-hidden="true" />
        <span className="sr-only">Sending</span>
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-text-muted">
        <Check size={12} aria-hidden="true" />
        <span className="sr-only">Sent</span>
      </span>
    );
  }
  return null;
}

function MessageBubbleComponent({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isFailed = message.status === 'failed';
  const authorLabel = isUser ? 'You said' : 'Assistant said';

  return (
    <div
      // Grouping role + label gives screen readers clear authorship context.
      role="group"
      aria-roledescription={isUser ? 'Your message' : 'Assistant message'}
      className={clsx(
        'flex w-full items-end gap-3 px-4 py-2 sm:px-6 [animation:var(--animate-fade-in-up)]',
        isUser && 'flex-row-reverse',
      )}
    >
      {!isUser && <Avatar role="bot" />}

      <div
        className={clsx(
          'flex min-w-0 max-w-[min(85%,42rem)] flex-col gap-1',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={clsx(
            'rounded-bubble px-4 py-2.5 text-[0.9375rem] leading-relaxed shadow-sm ring-1',
            // `whitespace-pre-wrap` preserves user line breaks; `break-words`
            // prevents long unbroken strings from overflowing the bubble.
            'whitespace-pre-wrap break-words',
            isUser
              ? 'rounded-br-sm bg-user-bubble text-white ring-accent-strong/50'
              : 'rounded-bl-sm bg-bot-bubble text-text-primary ring-border-subtle',
            isFailed && 'ring-danger/60',
          )}
        >
          <span className="sr-only">{authorLabel}: </span>
          {/* Rendered as text — React escapes content, preventing XSS. */}
          {message.content}
        </div>

        <div
          className={clsx(
            'flex items-center gap-2 px-1',
            isUser ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <MessageTimestamp createdAt={message.createdAt} />
          {isUser && !isFailed && <DeliveryStatus status={message.status} />}

          {isFailed && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                <AlertCircle size={12} aria-hidden="true" />
                Not delivered
              </span>
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                  'text-accent transition-colors hover:bg-accent-soft/60 hover:text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
                aria-label="Retry sending this message"
              >
                <RotateCw size={12} aria-hidden="true" />
                Retry
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Memoised so that appending a new message (or the typing indicator toggling)
 * never re-renders the thousands of rows already on screen — essential for
 * smooth performance with large conversations.
 */
export const MessageBubble = memo(MessageBubbleComponent);
