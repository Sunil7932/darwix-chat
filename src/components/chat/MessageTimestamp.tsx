import { formatClockTime, formatFullTimestamp, toIso } from '@/lib/time';
import { Tooltip } from '@/components/ui/Tooltip';

interface MessageTimestampProps {
  createdAt: number;
}

/**
 * Renders the short clock time for a message and reveals the full, unambiguous
 * timestamp on hover/focus via a tooltip. Uses a semantic `<time>` element with
 * a machine-readable `dateTime` for assistive tech and crawlers.
 */
export function MessageTimestamp({ createdAt }: MessageTimestampProps) {
  const full = formatFullTimestamp(createdAt);
  return (
    <Tooltip label={full}>
      <time
        dateTime={toIso(createdAt)}
        // The tooltip provides the rich label; `title` is a native fallback.
        title={full}
        className="cursor-default text-[11px] tabular-nums text-text-muted"
      >
        {formatClockTime(createdAt)}
      </time>
    </Tooltip>
  );
}
