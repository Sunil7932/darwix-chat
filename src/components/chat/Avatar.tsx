import { Bot, User } from 'lucide-react';
import { clsx } from 'clsx';
import type { MessageRole } from '@/types/chat';

interface AvatarProps {
  role: MessageRole;
}

/**
 * Decorative role indicator shown beside each message. The icon is hidden from
 * assistive tech (`aria-hidden`) because the message group already carries an
 * accessible "You said" / "Assistant said" label.
 */
export function Avatar({ role }: AvatarProps) {
  const isBot = role === 'bot';
  return (
    <div
      aria-hidden="true"
      className={clsx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1',
        isBot
          ? 'bg-accent-soft text-text-primary ring-accent/40'
          : 'bg-surface-raised text-text-secondary ring-border-subtle',
      )}
    >
      {isBot ? <Bot size={18} strokeWidth={2} /> : <User size={18} strokeWidth={2} />}
    </div>
  );
}
