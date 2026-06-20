/**
 * Domain types for the chat interface.
 *
 * These types are the single source of truth for message shape across the app
 * and the persistence layer. Keep them serialisable (no class instances, no
 * functions) so they can be safely written to and validated from `localStorage`.
 */

/** Who authored a message. */
export type MessageRole = 'user' | 'bot';

/**
 * Delivery lifecycle of a message.
 *
 * - `sending`  — optimistic local state, awaiting acknowledgement.
 * - `sent`     — successfully delivered.
 * - `failed`   — delivery failed; the user may retry.
 */
export type MessageStatus = 'sending' | 'sent' | 'failed';

/** A single chat message. */
export interface Message {
  /** Stable unique identifier (used as React key and for retry targeting). */
  id: string;
  /** Author of the message. */
  role: MessageRole;
  /** Plain-text content. Rendered as text (never HTML) to avoid XSS. */
  content: string;
  /** Creation time as epoch milliseconds (UTC). */
  createdAt: number;
  /** Current delivery status. Bot messages are always `sent`. */
  status: MessageStatus;
}

/** Shape of the persisted session, versioned for forward-compatible migrations. */
export interface PersistedSession {
  /** Schema version of the persisted payload. */
  version: number;
  /** Ordered messages, oldest first. */
  messages: Message[];
  /** Epoch ms of the last write. */
  updatedAt: number;
}
