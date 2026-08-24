import { Button } from "@jmouse/ui"

/**
 * An address, shown in full and copyable.
 *
 * ⚠️ **Shown in full rather than truncated to a name.** A share link is quoted into a chat message and
 * pasted into a browser bar by somebody who has to be able to see that it is the right one — a row
 * reading "Share token · Copy" hides exactly the thing being copied.
 */
export function LinkRow({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string
  url: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <span className="text-xs font-medium">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground hover:underline"
        title={url}
      >
        {url}
      </a>
      <Button variant="ghost" size="sm" onClick={onCopy}>
        {copied ? "✓ Copied" : "Copy"}
      </Button>
    </div>
  )
}
