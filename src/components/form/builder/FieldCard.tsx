import type { DragEvent, ReactNode } from "react"
import { ChevronDown, GripVertical, Zap } from "lucide-react"
import { cn } from "@jmouse/ui"
import type { FieldSummary } from "@/types"
import { fieldTypeOf } from "@/lib/fieldTypes"

/**
 * One field as a row that opens where it stands.
 *
 * ⚠️ **This is the shape both screens now use** — the builder's schema and the catalogue. They were a
 * dense list beside a pane and a list of rows opening a sheet: two ways to edit one thing, of which the
 * second was never the one anybody learned. One row shape, one editor inside it.
 *
 * ⚠️ **The whole head toggles; the trailing controls are its siblings.** A `<button>` inside a
 * `<button>` is invalid markup — React says so and the browser silently reparents it — so the head is
 * the target and remove/move/delete sit beside it, under the same paint.
 *
 * ⚠️ **Expanded is a state of the ROW, not a mode of the screen.** Nothing above the row moves when it
 * opens, which is the whole difference from the old builder: there, opening a field swapped a pane the
 * reader was not looking at, and the list they were navigating by scrolled under them.
 */
export function FieldCard({
  field,
  isExpanded,
  onToggle,
  ordinal,
  hasCondition = false,
  isDropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  badges,
  actions,
  children,
}: {
  field: FieldSummary
  isExpanded: boolean
  onToggle: () => void
  /** Its place in the form, one-based. Absent in the catalogue, where a field has no position. */
  ordinal?: number
  hasCondition?: boolean
  isDropTarget?: boolean
  onDragStart?: () => void
  onDragOver?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
  /** Marks read at a glance — the type, a unit, how it is used. */
  badges?: ReactNode
  /** Controls that act on the row rather than on the field's content — move, detach, delete. */
  actions?: ReactNode
  /** The editor. Rendered only while expanded, so a list of forty fields mounts one of them. */
  children?: ReactNode
}) {
  const descriptor = fieldTypeOf(field.elementType)
  const isDraggable = !!onDragStart && !isExpanded

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group/field overflow-hidden rounded-lg border bg-card transition-colors",
        isExpanded ? "border-primary/40 shadow-sm" : "hover:border-foreground/20 hover:bg-accent/30",
        isDropTarget && "outline-2 outline-offset-[-2px] outline-primary",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        {onDragStart && (
          <GripVertical
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 cursor-grab opacity-0 transition-opacity group-hover/field:opacity-50",
              isExpanded && "cursor-not-allowed group-hover/field:opacity-20",
            )}
          />
        )}

        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5 text-left"
        >
          {ordinal !== undefined && (
            <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{ordinal}</span>
          )}

          <span
            aria-hidden="true"
            title={descriptor.label}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md border text-sm transition-colors",
              isExpanded ? "border-primary bg-primary text-primary-foreground" : "bg-muted/60",
            )}
          >
            {field.icon || descriptor.glyph}
          </span>

          <span className="truncate text-sm font-medium">{field.label}</span>
          {/* ⚠️ Gone below `sm`, not shrunk. On a phone the two of them share about twelve characters,
              and truncating both leaves `Man…  part_m…` — two halves of nothing. The label is the half
              somebody is scanning for; the identifier is a tap away on the field's own page. */}
          <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">{field.name}</span>

          {field.required && (
            <span className="shrink-0 text-destructive" title="Required" aria-label="Required">
              ✱
            </span>
          )}
          {hasCondition && <Zap className="size-3 shrink-0 text-warning" aria-label="Has a condition" />}
        </button>

        {badges && <span className="hidden shrink-0 items-center gap-1.5 sm:flex">{badges}</span>}

        {/* ⚠️ Quiet until the row is touched, and `focus-within` as well as hover — a control that
            vanishes from the keyboard is a control nobody tabbing can reach. */}
        {actions && (
          <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/field:opacity-100 group-hover/field:opacity-100">
            {actions}
          </span>
        )}

        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 opacity-40 transition-transform", isExpanded && "rotate-180 opacity-100")}
        />
      </div>

      {isExpanded && children && (
        <div className="animate-in fade-in slide-in-from-top-1 border-t duration-150">{children}</div>
      )}
    </div>
  )
}
