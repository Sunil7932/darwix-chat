/**
 * Generates a collision-resistant unique identifier.
 *
 * Prefers the platform `crypto.randomUUID()` (available in all modern browsers
 * and secure contexts). Falls back to a timestamp + random suffix so the app
 * never crashes in older or non-secure environments.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
