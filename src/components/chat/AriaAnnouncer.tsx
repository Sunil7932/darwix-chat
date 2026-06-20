import { useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/chat';

interface AriaAnnouncerProps {
  messages: Message[];
  isBotTyping: boolean;
}

/**
 * Centralised screen-reader announcements.
 *
 * Because the transcript is virtualised, off-screen messages aren't in the DOM,
 * so a live region on the list itself can't be relied upon. Instead we mirror
 * the latest relevant change into dedicated visually-hidden live regions:
 *
 * - polite  → new assistant replies and the typing state.
 * - assertive → delivery failures, which the user should hear promptly.
 */
export function AriaAnnouncer({ messages, isBotTyping }: AriaAnnouncerProps) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const lastMessageId = useRef<string | null>(null);
  const announcedFailures = useRef<Set<string>>(new Set());

  // Announce the newest message when it changes.
  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === lastMessageId.current) return;
    lastMessageId.current = latest.id;

    if (latest.role === 'bot') {
      setPolite(`Assistant said: ${latest.content}`);
    }
  }, [messages]);

  // Announce typing transitions politely.
  useEffect(() => {
    if (isBotTyping) setPolite('Assistant is typing');
  }, [isBotTyping]);

  // Announce any newly-failed message assertively (once each).
  useEffect(() => {
    const failed = messages.find(
      (m) => m.status === 'failed' && !announcedFailures.current.has(m.id),
    );
    if (failed) {
      announcedFailures.current.add(failed.id);
      setAssertive('A message failed to send. Use the retry button to try again.');
    }
  }, [messages]);

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  );
}
