# Darwix AI — Chat Interface

A production-grade, accessible, high-performance chat interface built for the
Darwix AI Frontend Developer assessment.

It implements the full message lifecycle (optimistic send → delivery → retry on
failure → bot reply), session persistence, a typing indicator, and a
**virtualised transcript** that stays smooth with thousands of messages — all
wrapped in a responsive, keyboard-navigable, screen-reader-friendly UI.

> **Tech stack:** React 19 · TypeScript (strict) · Vite 6 · Tailwind CSS v4 ·
> TanStack Virtual · lucide-react

---

## Quick start

```bash
# Requirements: Node 18+ (developed on Node 22)
npm install
npm run dev          # start the dev server → http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check (tsc -b) + production build to /dist
npm run preview      # serve the production build locally
npm run lint         # ESLint
npm run typecheck    # type-check only
```

### Try these things

- **Send a message** — type and press **Enter** (use **Shift + Enter** for a new line).
- **Watch failures & retry** — ~18% of sends intentionally "fail" so you can see
  the *Not delivered → Retry* flow (simulated network).
- **Load the demo** — open the **⋮ menu → Load demo conversation** to drop in
  **1,000 messages** and watch virtualisation keep scrolling buttery-smooth.
- **Scroll up** — a *Jump to latest* pill appears with an unread count; new
  messages won't yank you back down while you read history.
- **Reload the page** — your conversation is restored from `localStorage`.

---

## How requirements were met

Every item from the brief, and where it lives in the code:

### Layout
- **Header / scrollable area / fixed input** — a full-height flex column
  (`App.tsx`) keeps the header and composer pinned while the middle region
  scrolls. Uses `100dvh` so mobile browser chrome doesn't clip the input.
- **Dynamic messages + graceful scrolling** — `MessageList.tsx` appends messages
  reactively with a thin, themed scrollbar and momentum-friendly
  `overscroll-contain`.

### Message design
- **Distinct user/bot styling** — `MessageBubble.tsx`: user bubbles are
  accent-filled and right-aligned; bot bubbles are neutral and left-aligned.
- **Visual indicator on bot messages** — a bot avatar/icon (`Avatar.tsx`).
- **Timestamps + hover detail** — `MessageTimestamp.tsx` shows a short clock time
  and reveals the full date/time on hover **and** keyboard focus via an
  accessible tooltip (`ui/Tooltip.tsx`), backed by a semantic `<time>` element.

### Functional
- **Multi-line input, send via button or Enter** — `ChatInput.tsx`: an
  auto-growing textarea; Enter sends, Shift+Enter inserts a newline, IME
  composition is respected.
- **Append + smart auto-scroll** — `useStickToBottom.ts` auto-scrolls to new
  messages **only when already at the bottom**, always follows the user's own
  sends, and counts unread messages while scrolled away.
- **Graceful errors + retry** — failed sends surface an inline *Retry* control;
  the message state machine lives in `useChat.ts`.

### Accessibility
- Full keyboard operability; visible focus rings (`:focus-visible`).
- A **skip link** to jump straight to the composer.
- Semantic roles (`role="log"`, message `group`s with `aria-roledescription`).
- A dedicated **live-region announcer** (`AriaAnnouncer.tsx`) announces new bot
  replies, typing, and delivery failures — necessary because virtualised rows
  aren't all in the DOM.
- Focus is returned to the composer after sending; menus close on `Escape` and
  restore focus to their trigger.
- Honors `prefers-reduced-motion`.

### Advanced
- **Save/load history** — `lib/storage.ts` persists to `localStorage` (debounced)
  and **strictly validates** the data on load (treated as untrusted input).
- **Typing indicator** — animated `TypingIndicator.tsx`, modelled as a virtual row.
- **Large numbers of messages** — windowed rendering via TanStack Virtual with
  dynamic row measurement and a memoised row component.

### Performance & responsiveness
- Only the visible rows (plus a small overscan) are mounted — verified at 1,000
  messages: **~18 DOM rows** for an ~88,000px transcript.
- Memoised rows mean appending a message never re-renders the existing list.
- Fluid from 320px mobile up to large desktops.

---

## Architecture

```
src/
├── App.tsx                     # Shell: header + transcript + composer layout
├── main.tsx                    # React root
├── index.css                   # Tailwind v4 theme tokens, animations, base layer
│
├── types/
│   └── chat.ts                 # Message / session domain types
│
├── lib/                        # Framework-agnostic logic (easily unit-testable)
│   ├── id.ts                   # Safe UUID generation (with fallback)
│   ├── time.ts                 # Memoised Intl timestamp formatters
│   ├── storage.ts              # Validated localStorage persistence
│   ├── botSimulator.ts         # Simulated delivery, failures, replies, typing
│   └── demoData.ts             # 1,000-message generator for perf testing
│
├── hooks/
│   ├── useChat.ts              # Core state machine: send/deliver/retry/persist
│   └── useStickToBottom.ts     # Auto-scroll + unread tracking
│
└── components/
    ├── ErrorBoundary.tsx       # Recoverable top-level fallback
    └── chat/
        ├── ChatHeader.tsx      # Branding, status, accessible actions menu
        ├── MessageList.tsx     # Virtualised transcript
        ├── MessageBubble.tsx   # Memoised message row (status + retry)
        ├── MessageTimestamp.tsx
        ├── TypingIndicator.tsx
        ├── ChatInput.tsx       # Multi-line composer
        ├── ScrollToBottomButton.tsx
        ├── Avatar.tsx
        └── AriaAnnouncer.tsx   # Screen-reader live regions
```

**Design principles**

- **Separation of concerns** — pure logic in `lib/`, stateful orchestration in
  `hooks/`, presentation in `components/`. The UI never talks to storage directly.
- **The transcript is virtualised, but accessibility isn't sacrificed** — because
  off-screen rows aren't in the DOM, announcements are mirrored into dedicated
  ARIA live regions instead of relying on the list itself.
- **Async work is cancellable** — all timers/promises are tied to an
  `AbortController`, so clearing the chat or unmounting cleanly cancels in-flight
  bot replies without leaking state updates.
- **State updaters stay pure** — side effects (kicking off a delivery) are never
  run inside a `setState` updater, which React StrictMode intentionally
  double-invokes. This avoids duplicated bot replies.

---

## Security

This is a client-only app, but it follows defensive defaults:

- **No XSS** — message content is always rendered as **text** (React escapes it);
  `dangerouslySetInnerHTML` is never used.
- **Untrusted storage** — data read back from `localStorage` is fully validated
  and clamped (roles, statuses, lengths, counts) before re-entering app state.
- **No `eval`, no dynamic code execution, no secrets.** Input length is bounded.

---

## Assumptions

- **The bot/network is simulated.** There is no backend; `lib/botSimulator.ts`
  fakes latency, a configurable failure rate, typing time, and canned replies so
  the full UX (including error/retry) is demonstrable offline. Swapping in a real
  API means replacing that one module.
- **Persistence is per-browser** via `localStorage` (the brief asked to *simulate*
  session persistence). It's debounced and capped at 5,000 messages.
- **A single conversation** is modelled (no multi-thread/sidebar), keeping focus
  on the depth of the chat experience the brief describes.
- **Messages are plain text.** Rich text / markdown / attachments were treated as
  out of scope but the architecture leaves room for them.

---

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Uses `crypto.randomUUID`,
`AbortController`, `Intl`, and `dvh` units — all widely supported — with a UUID
fallback for non-secure contexts.
