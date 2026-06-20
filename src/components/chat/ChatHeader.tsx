import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, MoreVertical, Sparkles, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatHeaderProps {
  isBotTyping: boolean;
  messageCount: number;
  onClear: () => void;
  onLoadDemo: () => void;
}

/**
 * App header: branding, a live presence/status line, and an accessible actions
 * menu (clear conversation / load a large demo). The menu supports arrow-key
 * navigation between items, Escape dismissal, and focus trapping per WAI-ARIA
 * menu pattern.
 */
export function ChatHeader({
  isBotTyping,
  messageCount,
  onClear,
  onLoadDemo,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    // Focus the first menu item when menu opens.
    requestAnimationFrame(() => {
      itemsRef.current[0]?.focus();
    });

    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current?.contains(event.target as Node) ||
        triggerRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      closeMenu();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen, closeMenu]);

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    const currentIndex = items.indexOf(event.target as HTMLButtonElement);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        items[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case 'Escape': {
        event.preventDefault();
        closeMenu();
        break;
      }
      case 'Tab': {
        event.preventDefault();
        closeMenu();
        break;
      }
    }
  };

  const runAction = (action: () => void) => {
    action();
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-subtle bg-surface px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet-500 shadow-md">
          <Sparkles size={20} className="text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-text-primary">
            Darwix Assistant
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-text-secondary" aria-live="polite">
            <span
              className={clsx(
                'inline-block h-2 w-2 rounded-full',
                isBotTyping ? 'animate-pulse bg-accent' : 'bg-success',
              )}
              aria-hidden="true"
            />
            {isBotTyping ? 'Typing…' : 'Online'}
          </p>
        </div>
      </div>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Conversation options"
          className={clsx(
            'inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors',
            'hover:bg-surface-raised hover:text-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Conversation options"
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl bg-surface-raised p-1.5 shadow-2xl ring-1 ring-border-subtle [animation:var(--animate-fade-in-up)]"
          >
            <button
              ref={(el) => { itemsRef.current[0] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => runAction(onLoadDemo)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-accent-soft/60 focus-visible:bg-accent-soft/60 focus-visible:outline-none"
            >
              <Database size={16} className="text-text-secondary" aria-hidden="true" />
              <span>
                Load demo conversation
                <span className="block text-[11px] text-text-muted">
                  1,000 messages · tests performance
                </span>
              </span>
            </button>
            <button
              ref={(el) => { itemsRef.current[1] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => runAction(onClear)}
              disabled={messageCount === 0}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft/50 focus-visible:bg-danger-soft/50 focus-visible:outline-none disabled:opacity-50"
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>Clear conversation</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
