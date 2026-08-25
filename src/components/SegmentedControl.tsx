import { cn } from "@jmouse/ui"

export interface Segment<Value extends string> {
  value: Value
  label: string
  /** A choice that exists but cannot be taken here — greyed rather than absent, so the set stays stable. */
  disabled?: boolean
}

/** How the control is painted. `solid` fills the chosen segment; `tabs` borrows the look of `TabsList`. */
export type SegmentedControlVariant = "solid" | "tabs"

/**
 * ⚠️ **There is ONE size, and removing the choice is the fix.**
 *
 * There were two — `compact` and `control` — and the difference was a pixel or two, so what they
 * actually produced was two switchers of different heights **in the same row**: 30px beside 29px beside
 * a 30px button. Nobody chooses that on purpose; it happens because a prop existed and two call sites
 * answered it differently.
 *
 * A size prop is only worth having when the sizes are far enough apart to mean something. These were
 * not, and a control that is *nearly* the height of its neighbours is worse than one that is plainly
 * smaller — it reads as a mistake rather than as a hierarchy.
 *
 * So: `Button size="sm"` — 30px, `rounded-md`, 12.5px — and no way to ask for anything else.
 */
const TRACK_STYLES: Record<SegmentedControlVariant, string> = {
  // ⚠️ `p-0`, and that is the part that matters. With padding, the track matched its neighbours while
  // the FILLED segment inside it stood 25px against their 30px — and the filled thing is what an eye
  // compares. Matching the frame while the paint disagrees is not matching.
  solid: "h-[30px] rounded-md border bg-muted/40 p-0",
  tabs: "h-9 rounded-lg bg-muted p-[3px] text-muted-foreground",
}

const SEGMENT_STYLES: Record<SegmentedControlVariant, string> = {
  solid: "h-full rounded-md px-3 text-[12.5px]",
  tabs: "h-full whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-sm font-medium",
}

const ACTIVE_SEGMENT_STYLES: Record<SegmentedControlVariant, string> = {
  solid: "bg-primary text-primary-foreground shadow-sm",
  tabs: "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30",
}

const IDLE_SEGMENT_STYLES: Record<SegmentedControlVariant, string> = {
  solid: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  tabs: "text-foreground/60 hover:text-foreground dark:text-muted-foreground",
}

/**
 * A small group of mutually exclusive choices — pick one, the others turn off.
 *
 * Written once because two screens had grown the same markup with slightly different corners — and then
 * grew two *sizes* and drifted again, which is why there is now exactly one of everything: 30px,
 * `rounded-md`, 12.5px, the same as a `Button size="sm"` and an `Input size="sm"` standing beside it.
 *
 * ⚠️ **The segment fills the track rather than floating inside it.** The nesting a track normally has —
 * an outer radius with a smaller one inset — is what made this read as foreign in a control row: the
 * chosen segment was five pixels shorter than the button next to it and a step rounder, so the two
 * filled shapes in one row never lined up. What a reader compares is the paint, not the frame.
 *
 * ⚠️ **`variant="tabs"` is for a control sitting directly under real tabs.** Two rows of choices in the
 * same corner of a screen — one a filled pill, one a raised tab — read as two unrelated mechanisms, so
 * the variant borrows `TabsList`'s paint and lets the second row read as the continuation it is. It
 * changes nothing about behaviour: this is still not a Radix Tabs, because there is no panel
 * relationship to model. It is a value and a setter, which is why it takes exactly those.
 */
export function SegmentedControl<Value extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  variant = "solid",
  fill = false,
  className,
}: {
  segments: Segment<Value>[]
  value: Value
  onChange: (value: Value) => void
  ariaLabel: string
  variant?: SegmentedControlVariant
  /** Stretch to the container. Off by default — a control sized to its own words reads as a filter. */
  fill?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center",
        TRACK_STYLES[variant],
        fill && "flex w-full",
        className,
      )}
    >
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          disabled={segment.disabled}
          onClick={() => onChange(segment.value)}
          aria-pressed={value === segment.value}
          className={cn(
            "inline-flex items-center justify-center transition-colors",
            SEGMENT_STYLES[variant],
            fill && "flex-1",
            segment.disabled && "cursor-not-allowed opacity-50",
            value === segment.value ? ACTIVE_SEGMENT_STYLES[variant] : IDLE_SEGMENT_STYLES[variant],
          )}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
