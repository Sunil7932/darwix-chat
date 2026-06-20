import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { MessageRole } from '@/types/chat';

interface StickToBottomOptions {
  /** Number of real messages (excludes the ephemeral typing row). */
  messageCount: number;
  /** Role of the most recent message — used to always follow the user's own sends. */
  lastMessageRole: MessageRole | null;
  /** Whether the bot typing row is currently visible. */
  isBotTyping: boolean;
  /** Imperatively scrolls the viewport to the very bottom. */
  scrollToEnd: (behavior: ScrollBehavior) => void;
}

export interface StickToBottomState {
  /** True when the viewport is following the bottom of the conversation. */
  isPinned: boolean;
  /** Count of new messages received while scrolled away from the bottom. */
  unreadCount: number;
  /** Scroll handler to attach to the viewport. */
  handleScroll: () => void;
  /** Programmatically jump to the latest message (e.g. button click). */
  jumpToBottom: (behavior?: ScrollBehavior) => void;
}

/** How close to the bottom (px) still counts as "pinned". */
const PIN_THRESHOLD_PX = 120;

/**
 * Implements "stick to bottom" behaviour for a scrollable, virtualised chat:
 *
 * - Auto-scrolls to the newest message **only** while the user is already at
 *   the bottom, so it never yanks the viewport away from someone reading history.
 * - Always follows the user's *own* outgoing messages.
 * - Tracks an unread counter while scrolled up, surfaced via a jump-to-latest pill.
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  { messageCount, lastMessageRole, isBotTyping, scrollToEnd }: StickToBottomOptions,
): StickToBottomState {
  const [isPinned, setIsPinned] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const isPinnedRef = useRef(true);
  const prevCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distanceFromBottom <= PIN_THRESHOLD_PX;
    isPinnedRef.current = pinned;
    setIsPinned(pinned);
    if (pinned) setUnreadCount(0);
  }, [scrollRef]);

  const jumpToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      scrollToEnd(behavior);
      isPinnedRef.current = true;
      setIsPinned(true);
      setUnreadCount(0);
    },
    [scrollToEnd],
  );

  // React to changes in the message count: new sends, resets, and hydration.
  useLayoutEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messageCount;
    if (messageCount === prev) return;

    // First paint or a reset (clear / load demo) — land at the bottom instantly.
    if (prev === 0 || messageCount < prev) {
      jumpToBottom('auto');
      return;
    }

    const userJustSent = lastMessageRole === 'user';
    if (userJustSent || isPinnedRef.current) {
      jumpToBottom('smooth');
    } else {
      setUnreadCount((count) => count + (messageCount - prev));
    }
  }, [messageCount, lastMessageRole, jumpToBottom]);

  // Keep the typing indicator in view for users who are following along.
  useLayoutEffect(() => {
    if (isBotTyping && isPinnedRef.current) jumpToBottom('smooth');
  }, [isBotTyping, jumpToBottom]);

  return { isPinned, unreadCount, handleScroll, jumpToBottom };
}
