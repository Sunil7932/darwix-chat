import { ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

interface ScrollToBottomButtonProps {
  visible: boolean;
  unreadCount: number;
  onClick: () => void;
}

/**
 * Floating "jump to latest" pill, shown only while the user is scrolled up.
 * Surfaces an unread count so it's clear new messages arrived below the fold.
 */
export function ScrollToBottomButton({
  visible,
  unreadCount,
  onClick,
}: ScrollToBottomButtonProps) {
  return (
    <div
      className={clsx(
        'pointer-events-none absolute inset-x-0 bottom-4 flex justify-center transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        // Hidden from tab order and AT when off-screen to avoid a focus trap.
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className={clsx(
          'pointer-events-auto inline-flex items-center gap-2 rounded-full bg-surface-raised py-2 pl-3 pr-4',
          'text-sm font-medium text-text-primary shadow-lg ring-1 ring-border-subtle',
          'transition-colors hover:bg-accent hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <ArrowDown size={16} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span>
            {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
          </span>
        ) : (
          <span>Jump to latest</span>
        )}
      </button>
    </div>
  );
}
