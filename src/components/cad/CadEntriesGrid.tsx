import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Badge, Button, cn } from "@jmouse/ui"
import { FieldValue } from "@/components/form/FieldValue"
import type { FormEntry } from "@/types"

/** What each stored kind is called, so a tile says what it is rather than what it is coded as. */
const KIND_LABELS: Record<string, string> = {
  SYMBOL: "Symbol",
  FOOTPRINT: "Footprint",
  MODEL_3D: "3D body",
}

/**
 * The CAD catalogue as tiles rather than as rows.
 *
 * ⚠️ **A footprint is recognised by looking at it, and a table of names is the wrong instrument.**
 * `Resistor_SMD:R_0805_2012Metric` and `Resistor_SMD:R_0805_2012Metric_Pad1.20x1.40mm` differ in a place
 * the eye slides over; the drawings differ at a glance. So the picture leads and the name supports it.
 *
 * ⚠️ **The identifier is copied, never retyped.** It is matched character for character against
 * libraries on somebody's own disk, so one wrong character is a part that lists fine and then places
 * nothing. A copy button is not a convenience here — it is the correctness mechanism.
 */
export function CadEntriesGrid({
  entries,
  selectedId,
  onOpen,
}: {
  entries: FormEntry[]
  /** Drawn as chosen, so the pane beside it is visibly about THIS row. */
  selectedId?: string | null
  onOpen: (entry: FormEntry) => void
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-3">
      {entries.map((entry) => (
        <CadTile
          key={entry.id}
          entry={entry}
          isSelected={entry.id === selectedId}
          onOpen={() => onOpen(entry)}
        />
      ))}
    </ul>
  )
}

function CadTile({
  entry,
  isSelected = false,
  onOpen,
}: {
  entry: FormEntry
  isSelected?: boolean
  onOpen: () => void
}) {
  const [copied, setCopied] = useState(false)

  const identifier = entry.fieldValues?.cad_identifier ?? ""
  const kind = entry.fieldValues?.cad_kind
  const library = entry.fieldValues?.cad_library
  const pinCount = entry.fieldValues?.cad_pin_count
  const preview = entry.fieldValues?.cad_preview

  function copy(event: React.MouseEvent) {
    event.stopPropagation()
    navigator.clipboard.writeText(identifier).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => setCopied(false),
    )
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && onOpen()}
        className={cn(
          "flex h-full cursor-pointer flex-col overflow-hidden rounded-md border bg-card",
          "hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          // ⚠️ A ring rather than a tint: a tinted tile competes with the preview it exists to show.
          isSelected ? "border-primary ring-1 ring-primary" : "border-border",
        )}
      >
        <PreviewPane preview={preview} kind={kind} />

        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <div className="flex items-start gap-1.5">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug">
              {identifier || <span className="text-muted-foreground">‹no identifier›</span>}
            </code>

            {/*
              ⚠️ Always rendered, never revealed on hover — a control that exists only under a pointer
              does not exist at all on a touch screen. And it stops the click from opening the record:
              copying and opening are different intents on the same tile.
            */}
            {identifier && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 shrink-0"
                aria-label={`Copy ${identifier}`}
                onClick={copy}
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </Button>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-1">
            {kind && (
              <Badge variant="secondary" className="text-[10px]">
                {KIND_LABELS[kind] ?? kind}
              </Badge>
            )}
            {pinCount && (
              <span className="text-[10px] tabular-nums text-muted-foreground">{pinCount} pins</span>
            )}
          </div>

          {library && (
            <span className="truncate text-[10px] text-muted-foreground" title={library}>
              {library}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * The picture, or an honest stand-in for one.
 *
 * ⚠️ **Drawn by the same component every other screen draws a stored image with.** A stored image field
 * holds `{viewToken}:{filename}` rather than an address, and `FieldValue` already turns that into the
 * public route — as well as passing a pasted link through and refusing to make a broken image out of
 * anything else. Re-implementing those three cases here would be a second reader of one format, and the
 * two would part company the first time the format grew a case.
 *
 * ⚠️ **A missing render is a prompt, not a failure.** Nobody has drawn previews for these yet and most
 * rows will not have one for a long time, so the tile says which kind of drawing it is in words rather
 * than showing a grey rectangle that reads as an image that would not load.
 */
function PreviewPane({ preview, kind }: { preview?: string; kind?: string }) {
  if (preview) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/40 p-2">
        <FieldValue
          value={preview}
          elementType="IMAGE"
          imageClassName="size-full max-h-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-muted/30">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {kind ? (KIND_LABELS[kind] ?? kind) : "no preview"}
      </span>
    </div>
  )
}
