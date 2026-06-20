import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/chat';
import { createId } from '@/lib/id';
import { clearSession, loadSession, saveSession } from '@/lib/storage';
import { delay, generateReply, getTypingDuration } from '@/lib/botSimulator';
import { createDemoMessages } from '@/lib/demoData';
import { ChatNotConfiguredError, streamChatReply } from '@/lib/chatClient';

/** Debounce window for persisting the conversation to storage. */
const PERSIST_DEBOUNCE_MS = 400;

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  content:
    "Hi! I’m the Darwix assistant, powered by Google Gemini. Ask me anything — your message streams to the model and the reply comes back token by token. Try a multi-line message with Shift + Enter, or load a large demo conversation from the menu to watch virtualisation at work.",
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
 * Owns the message list, the typing indicator, persistence, and the full
 * optimistic send → stream reply → (retry on failure) lifecycle. The reply is
 * streamed from the server-side Gemini proxy; if the server has no API key it
 * transparently falls back to an offline canned reply so the app still runs.
 *
 * All asynchronous work is tied to an `AbortController` so a reset (clear / load
 * demo) or unmount cleanly cancels in-flight requests and timers.
 */
export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // A single controller governing all in-flight async work. Replaced on reset.
  const abortRef = useRef<AbortController>(new AbortController());
  const didHydrate = useRef(false);
  // Mirror of the latest messages for handlers that must read current state
  // without depending on it (keeps callbacks stable, avoids stale reads).
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
  // A fresh controller is installed on (re)mount so React StrictMode's
  // mount → unmount → remount cycle in development doesn't leave us holding an
  // already-aborted controller (which would silently cancel every send).
  useEffect(() => {
    abortRef.current = new AbortController();
    const controller = abortRef.current;
    return () => controller.abort();
  }, []);

  /** Replaces a message in place by id. */
  const patchMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  /** Removes a message by id. */
  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Offline fallback: typing indicator then a canned reply. */
  const runFallbackReply = useCallback(async (signal: AbortSignal) => {
    try {
      setIsBotTyping(true);
      await delay(getTypingDuration(), signal);
      const reply: Message = {
        id: createId(),
        role: 'bot',
        content: generateReply(),
        createdAt: Date.now(),
        status: 'sent',
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      /* aborted */
    } finally {
      if (!signal.aborted) setIsBotTyping(false);
    }
  }, []);

  /**
   * Streams the assistant's reply for a user message, appending tokens as they
   * arrive. On failure marks the user message as failed (retryable). Falls back
   * to the offline bot when the server reports no API key is configured.
   */
  const deliver = useCallback(
    async (userId: string, content: string, signal: AbortSignal) => {
      // Build the history sent upstream: prior delivered messages plus this one.
      const history = messagesRef.current.filter(
        (m) => m.id === userId || m.status === 'sent',
      );
      if (!history.some((m) => m.id === userId)) {
        history.push({
          id: userId,
          role: 'user',
          content,
          createdAt: Date.now(),
          status: 'sending',
        });
      }

      let botId: string | null = null;
      try {
        await streamChatReply(history, {
          signal,
          onOpen: () => {
            // Server accepted the message — mark delivered, show typing.
            patchMessage(userId, { status: 'sent' });
            setIsBotTyping(true);
          },
          onToken: (delta) => {
            if (botId === null) {
              botId = createId();
              const id = botId;
              setIsBotTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id,
                  role: 'bot',
                  content: delta,
                  createdAt: Date.now(),
                  status: 'sent',
                },
              ]);
            } else {
              const id = botId;
              setMessages((prev) =>
                prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
              );
            }
          },
        });
      } catch (error) {
        if (signal.aborted) return;

        // No backend key → degrade gracefully to the offline simulator.
        if (error instanceof ChatNotConfiguredError) {
          patchMessage(userId, { status: 'sent' });
          await runFallbackReply(signal);
          return;
        }

        // Genuine transport/upstream failure → offer a retry.
        if (botId) removeMessage(botId);
        patchMessage(userId, { status: 'failed' });
        if (!signal.aborted) setIsBotTyping(false);
      }
    },
    [patchMessage, removeMessage, runFallbackReply],
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
