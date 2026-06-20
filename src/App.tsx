import { useMemo } from 'react';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { AriaAnnouncer } from '@/components/chat/AriaAnnouncer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useChat } from '@/hooks/useChat';

/**
 * Application shell.
 *
 * Lays out the three fixed regions required by the brief — a header, a
 * scrollable transcript, and a pinned composer — within a full-height flex
 * column so the middle region scrolls while the edges stay put. Uses dynamic
 * viewport units (`100dvh`) so the layout is correct on mobile browsers where
 * the URL bar collapses.
 */
export default function App() {
  const {
    messages,
    isBotTyping,
    isHydrated,
    sendMessage,
    retryMessage,
    clearChat,
    loadDemoConversation,
  } = useChat();

  // A welcome message always exists, so "empty" means only the seeded greeting.
  const realMessageCount = useMemo(
    () => messages.filter((m) => m.id !== 'welcome').length,
    [messages],
  );

  return (
    <ErrorBoundary>
      {/* Skip link for keyboard users to bypass the header. */}
      <a
        href="#chat-composer"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to message input
      </a>

      <div className="flex h-[100dvh] w-full flex-col bg-canvas">
        <ChatHeader
          isBotTyping={isBotTyping}
          messageCount={realMessageCount}
          onClear={clearChat}
          onLoadDemo={() => loadDemoConversation(1_000)}
        />

        <main className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
          {isHydrated ? (
            <MessageList
              messages={messages}
              isBotTyping={isBotTyping}
              onRetry={retryMessage}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
              Loading conversation…
            </div>
          )}
        </main>

        <ChatInput onSend={sendMessage} disabled={!isHydrated} />
      </div>

      <AriaAnnouncer messages={messages} isBotTyping={isBotTyping} />
    </ErrorBoundary>
  );
}
