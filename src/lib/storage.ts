import type { Message, MessageRole, MessageStatus, PersistedSession } from '@/types/chat';

/**
 * Session persistence layer (localStorage-backed).
 *
 * Security note: data read back from `localStorage` is treated as *untrusted
 * input*. It may have been tampered with, corrupted, or written by an older
 * app version. Every field is validated and coerced before it is allowed back
 * into application state, and oversized payloads are rejected. Nothing here is
 * `eval`-ed or rendered as HTML.
 */

const STORAGE_KEY = 'darwix.chat.session.v1';
const SCHEMA_VERSION = 1;

/** Hard caps to bound memory and guard against malicious/corrupt payloads. */
const MAX_MESSAGES = 5_000;
const MAX_CONTENT_LENGTH = 8_000;

const VALID_ROLES: ReadonlySet<MessageRole> = new Set<MessageRole>(['user', 'bot']);
const VALID_STATUSES: ReadonlySet<MessageStatus> = new Set<MessageStatus>([
  'sending',
  'sent',
  'failed',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validates and normalises a single persisted record into a `Message`. */
function parseMessage(raw: unknown): Message | null {
  if (!isObject(raw)) return null;

  const { id, role, content, createdAt, status } = raw;

  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null;
  if (typeof role !== 'string' || !VALID_ROLES.has(role as MessageRole)) return null;
  if (typeof content !== 'string') return null;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;

  // Tolerate unknown/legacy statuses by defaulting to a safe terminal state.
  const safeStatus: MessageStatus =
    typeof status === 'string' && VALID_STATUSES.has(status as MessageStatus)
      ? (status as MessageStatus)
      : 'sent';

  return {
    id,
    role: role as MessageRole,
    // Clamp length to avoid unbounded strings; React still renders this as text.
    content: content.slice(0, MAX_CONTENT_LENGTH),
    createdAt,
    // A message can never be persisted as still "sending" — resolve to failed
    // so the user is offered a retry rather than a stuck spinner.
    status: safeStatus === 'sending' ? 'failed' : safeStatus,
  };
}

/** Reads and validates the persisted session. Returns `null` when absent/invalid. */
export function loadSession(): Message[] | null {
  if (typeof localStorage === 'undefined') return null;

  let rawString: string | null;
  try {
    rawString = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Access can throw (e.g. Safari private mode, disabled storage).
    return null;
  }
  if (!rawString) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawString);
  } catch {
    return null;
  }

  if (!isObject(parsed) || !Array.isArray(parsed.messages)) return null;
  if (parsed.version !== SCHEMA_VERSION) return null;

  const messages: Message[] = [];
  for (const candidate of parsed.messages.slice(0, MAX_MESSAGES)) {
    const message = parseMessage(candidate);
    if (message) messages.push(message);
  }

  return messages;
}

/** Serialises and persists the session. Failures are swallowed (best-effort). */
export function saveSession(messages: Message[]): void {
  if (typeof localStorage === 'undefined') return;

  const payload: PersistedSession = {
    version: SCHEMA_VERSION,
    messages: messages.slice(-MAX_MESSAGES),
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage unavailable — degrade gracefully, no crash.
  }
}

/** Clears the persisted session. */
export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
