import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/chat';
import { createId } from '@/lib/id';
import { clearSession, loadSession, saveSession } from '@/lib/storage';
import {
  generateReply,
  getTypingDuration,
  delay,
  simulateDelivery,
} from '@/lib/botSimulator';
import { createDemoMessages } from '@/lib/demoData';

/** Debounce window for persisting the conversation to storage. */
const PERSIST_DEBOUNCE_MS = 400;

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  content:
    "Hi! I’m the Darwix assistant. Ask me anything to see the chat in action — try sending a multi-line message with Shift + Enter, or load a large demo conversation from the menu to watch virtualisation at work.",
  createdAt: Date.now(),
  status: 'sent',
};

export interface UseChatResult {
  messages: Message[];
  isBotTyping: boolean;
  /** True until the persisted session has been hydrated (avoids a flash). */
  isHydrated: boolean;
  sendMessage: (content: string) => void;
  retryMessage: (id: string) => void;
  clearChat: () => void;
  loadDemoConversation: (count?: number) => void;
}

/**
 * Core chat state machine.
 *
 * Owns the message list, the bot typing indicator, persistence, and the full
 * optimistic send → deliver → (retry | bot reply) lifecycle. All asynchronous
 * work is tied to an `AbortController` so a reset (clear / load demo) or unmount
 * cleanly cancels in-flight timers without leaking state updates.
 */
export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // A single controller governing all in-flight async work. Replaced on reset.
  const abortRef = useRef<AbortController>(new AbortController());
  const didHydrate = useRef(false);
  // Mirror of the latest messages for event handlers that must read current
  // state without depending on it (keeps callbacks stable, avoids stale reads).
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // --- Hydration: load persisted session once on mount. --------------------
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;

    const persisted = loadSession();
    setMessages(persisted && persisted.length > 0 ? persisted : [WELCOME_MESSAGE]);
    setIsHydrated(true);
  }, []);

  // --- Persistence: debounced save whenever the conversation changes. ------
  useEffect(() => {
    if (!isHydrated) return;
    const handle = window.setTimeout(() => saveSession(messages), PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [messages, isHydrated]);

  // --- Cancel everything on unmount. ---------------------------------------
  // A fresh controller is installed on (re)mount so that React StrictMode's
  // mount → unmount → remount cycle in development doesn't leave us holding an
  // already-aborted controller (which would silently cancel every send).
  useEffect(() => {
    abortRef.current = new AbortController();
    const controller = abortRef.current;
    return () => controller.abort();
  }, []);

  /** Replaces a message in place by id. */
  const patchMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  /** Runs the bot "typing → reply" sequence for a given user prompt. */
  const runBotReply = useCallback(
    async (prompt: string, signal: AbortSignal) => {
      try {
        setIsBotTyping(true);
        await delay(getTypingDuration(), signal);

        const reply: Message = {
          id: createId(),
          role: 'bot',
          content: generateReply(prompt),
          createdAt: Date.now(),
          status: 'sent',
        };
        setMessages((prev) => [...prev, reply]);
      } catch {
        // Aborted — nothing to do.
      } finally {
        if (!signal.aborted) setIsBotTyping(false);
      }
    },
    [],
  );

  /** Attempts delivery of an existing (sending) message, then a bot reply. */
  const deliver = useCallback(
    async (id: string, content: string, signal: AbortSignal) => {
      try {
        await simulateDelivery(signal);
        if (signal.aborted) return;
        patchMessage(id, { status: 'sent' });
        await runBotReply(content, signal);
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        // Real (simulated) delivery failure → surface a retry affordance.
        patchMessage(id, { status: 'failed' });
      }
    },
    [patchMessage, runBotReply],
  );

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (trimmed.length === 0) return;

      const message: Message = {
        id: createId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        status: 'sending',
      };
      setMessages((prev) => [...prev, message]);
      void deliver(message.id, trimmed, abortRef.current.signal);
    },
    [deliver],
  );

  const retryMessage = useCallback(
    (id: string) => {
      // Read current state from the ref and keep the side effect *outside* any
      // state updater — updaters must be pure (StrictMode invokes them twice).
      const target = messagesRef.current.find((m) => m.id === id);
      if (!target || target.status !== 'failed') return;
      patchMessage(id, { status: 'sending' });
      void deliver(id, target.content, abortRef.current.signal);
    },
    [deliver, patchMessage],
  );

  /** Aborts in-flight work and installs a fresh controller. */
  const resetPendingWork = useCallback(() => {
    abortRef.current.abort();
    abortRef.current = new AbortController();
    setIsBotTyping(false);
  }, []);

  const clearChat = useCallback(() => {
    resetPendingWork();
    clearSession();
    setMessages([{ ...WELCOME_MESSAGE, createdAt: Date.now() }]);
  }, [resetPendingWork]);

  const loadDemoConversation = useCallback(
    (count = 1_000) => {
      resetPendingWork();
      setMessages(createDemoMessages(count));
    },
    [resetPendingWork],
  );

  return {
    messages,
    isBotTyping,
    isHydrated,
    sendMessage,
    retryMessage,
    clearChat,
    loadDemoConversation,
  };
}
