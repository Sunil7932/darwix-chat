import { useId, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

interface TooltipProps {
  /** Tooltip text content. */
  label: string;
  /** Trigger element. */
  children: ReactNode;
  /** Placement relative to the trigger. */
  placement?: 'top' | 'bottom';
  className?: string;
}

/**
 * A lightweight, accessible tooltip.
 *
 * Reveals on both hover *and* keyboard focus (so it is not mouse-only), wires
 * the trigger to the bubble via `aria-describedby`, and is dismissible with
 * Escape per WAI-ARIA tooltip guidance.
 */
export function Tooltip({ label, children, placement = 'top', className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={clsx(
          'pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md',
          'bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-lg',
          'ring-1 ring-border-subtle transition-opacity duration-150',
          placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
