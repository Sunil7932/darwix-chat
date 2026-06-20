import { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '@/types/chat';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ScrollToBottomButton } from '@/components/chat/ScrollToBottomButton';
import { useStickToBottom } from '@/hooks/useStickToBottom';

interface MessageListProps {
  messages: Message[];
  isBotTyping: boolean;
  onRetry: (id: string) => void;
}

/** Estimated row height (px) before a row is measured. */
const ESTIMATED_ROW_HEIGHT = 88;
/** Sentinel key for the ephemeral typing row appended after the messages. */
const TYPING_ROW_KEY = '__typing__';

/**
 * Virtualised, auto-scrolling message transcript.
 *
 * Only the rows within the viewport (plus a small overscan) are mounted, so the
 * DOM stays small and interaction stays smooth even with thousands of messages.
 * Row heights are measured dynamically to support multi-line content.
 */
export function MessageList({ messages, isBotTyping, onRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // The typing indicator is modelled as one extra virtual row at the end.
  const rowCount = messages.length + (isBotTyping ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    // Stable keys let React recycle DOM nodes correctly across scroll + updates.
    getItemKey: (index) =>
      index < messages.length ? (messages[index]?.id ?? index) : TYPING_ROW_KEY,
  });

  const scrollToEnd = useCallback(
    (behavior: ScrollBehavior) => {
      if (rowCount === 0) return;
      virtualizer.scrollToIndex(rowCount - 1, { align: 'end', behavior });
    },
    [virtualizer, rowCount],
  );

  const lastMessage = messages[messages.length - 1];
  const { isPinned, unreadCount, handleScroll, jumpToBottom } = useStickToBottom(
    scrollRef,
    {
      messageCount: messages.length,
      lastMessageRole: lastMessage?.role ?? null,
      isBotTyping,
      scrollToEnd,
    },
  );

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        // `log` + polite live semantics describe the transcript; new-message
        // announcements are handled by the dedicated AriaAnnouncer for reliability.
        role="log"
        aria-label="Conversation transcript"
        aria-live="polite"
        aria-relevant="additions"
        tabIndex={0}
        className="scrollbar-slim h-full overflow-y-auto overscroll-contain py-4"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          className="relative w-full"
        >
          {virtualItems.map((virtualRow) => {
            const isTypingRow = virtualRow.index >= messages.length;
            const message = messages[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {isTypingRow || !message ? (
                  <TypingIndicator />
                ) : (
                  <MessageBubble message={message} onRetry={onRetry} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ScrollToBottomButton
        visible={!isPinned}
        unreadCount={unreadCount}
        onClick={() => jumpToBottom('smooth')}
      />
    </div>
  );
}
