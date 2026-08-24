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
 * How big it is drawn.
 *
 * ⚠️ **`control` matches the height of an `Input` and a small `Button`, and that is the whole point.**
 * A page header is a row of controls read as one row, so a segment control shorter than the search box
 * beside it reads as a caption that happens to be clickable rather than as its equal. `compact` stays
 * for a filter row *under* the header, where being smaller than the header is the correct signal.
 */
export type SegmentedControlSize = "compact" | "control"

const TRACK_SIZES: Record<SegmentedControlSize, string> = {
  compact: "",
  control: "h-8",
}

const SEGMENT_SIZES: Record<SegmentedControlSize, string> = {
  compact: "",
  control: "h-full px-3 text-sm",
}

const TRACK_STYLES: Record<SegmentedControlVariant, string> = {
  solid: "gap-0.5 rounded-lg border bg-muted/40 p-0.5",
  tabs: "h-9 rounded-lg bg-muted p-[3px] text-muted-foreground",
}

const SEGMENT_STYLES: Record<SegmentedControlVariant, string> = {
  solid: "rounded-md px-2.5 py-1 text-xs",
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
 * Written once because two screens had grown the same markup with slightly different corners, and it
 * shows: the radii come from the theme's `--radius` the way every button does, so the control sits in
 * the same family as the board's filter toggles rather than reading as a sharp-cornered stranger. The
 * track is `rounded-lg`, the thumb `rounded-md`, which is the nesting the rest of the interface uses.
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
  size = "compact",
  fill = false,
  className,
}: {
  segments: Segment<Value>[]
  value: Value
  onChange: (value: Value) => void
  ariaLabel: string
  variant?: SegmentedControlVariant
  /** How tall. `control` sits in a page header beside inputs and buttons; `compact` in a filter row. */
  size?: SegmentedControlSize
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
        TRACK_SIZES[size],
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
            SEGMENT_SIZES[size],
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
