import type { KitSection } from "../Specimen"

/**
 * What everything else is made of — and it is a **swatch board rather than a list of hex values**,
 * because a token's whole job is to be right in all 29 palettes and a hex value is right in one.
 */

/** Every semantic colour the product paints with, in the pairs they are used in. */
const SURFACES: { token: string; label: string; className: string }[] = [
  { token: "background / foreground", label: "the page", className: "bg-background text-foreground" },
  { token: "card / card-foreground", label: "a raised surface", className: "bg-card text-card-foreground" },
  { token: "muted / muted-foreground", label: "a quiet ground", className: "bg-muted text-muted-foreground" },
  { token: "accent / accent-foreground", label: "hover, and a chosen row", className: "bg-accent text-accent-foreground" },
  { token: "primary / primary-foreground", label: "the one action", className: "bg-primary text-primary-foreground" },
  { token: "secondary / secondary-foreground", label: "a mark", className: "bg-secondary text-secondary-foreground" },
  {
    token: "destructive / destructive-foreground",
    label: "it takes something away",
    className: "bg-destructive text-destructive-foreground",
  },
  { token: "popover / popover-foreground", label: "a layer over the page", className: "bg-popover text-popover-foreground" },
  { token: "sidebar / sidebar-foreground", label: "the column", className: "bg-sidebar text-sidebar-foreground" },
]

/** The three that are ours rather than shadcn's, and the reason they exist. */
const SIGNALS: { token: string; label: string; className: string }[] = [
  { token: "success", label: "it worked, it is in force", className: "text-success" },
  { token: "warning", label: "read this before pressing", className: "text-warning" },
  { token: "destructive", label: "it removes, it refuses", className: "text-destructive" },
]

const CHART_HUES = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]

export const foundationsSection: KitSection = {
  key: "foundations",
  label: "Основа",
  about: "Tokens, not values. Everything below is what the 29 palettes actually swap.",
  specimens: [
    {
      name: "surface",
      origin: "library",
      from: "@jmouse/ui/presets/themes.css",
      what: "A ground and the ink that is legible on it. Always taken as a pair.",
      note: (
        <>
          ⚠️ <strong>Never a bare colour.</strong> `bg-card` without `text-card-foreground` is a surface that
          reads in the theme it was written in and in no other.
        </>
      ),
      render: () => (
        <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map((surface) => (
            <div key={surface.token} className={`flex flex-col rounded-md border px-3 py-2 ${surface.className}`}>
              <span className="font-mono text-[11px]">{surface.token}</span>
              <span className="text-xs opacity-80">{surface.label}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      name: "signal",
      origin: "library",
      from: "@jmouse/ui/presets/themes.css",
      what: "The three meanings a colour is allowed to carry on its own.",
      note: "⚠️ Colour is never the only signal — each of these appears beside a word or a glyph that says the same thing.",
      render: () => (
        <div className="flex flex-wrap gap-4">
          {SIGNALS.map((signal) => (
            <span key={signal.token} className={`flex flex-col ${signal.className}`}>
              <span className="font-mono text-[11px]">{signal.token}</span>
              <span className="text-xs">{signal.label}</span>
            </span>
          ))}
        </div>
      ),
    },
    {
      name: "chart-hue",
      origin: "library",
      from: "@jmouse/ui/presets/themes.css",
      what: "Five hues far enough apart that two of them side by side are two colours.",
      note: "For a series in a chart, and for anything that colours a family — see `dot`.",
      render: () => (
        <div className="flex flex-wrap gap-2">
          {CHART_HUES.map((hue) => (
            <span key={hue} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
              <span className="size-3.5 rounded-full" style={{ backgroundColor: `var(--${hue})` }} />
              <span className="font-mono text-[11px]">{hue}</span>
            </span>
          ))}
        </div>
      ),
    },
    {
      name: "radius",
      origin: "library",
      from: "@jmouse/ui/styles.css",
      what: "The corner scale. A track is one step rounder than the thumb inside it.",
      render: () => (
        <div className="flex flex-wrap items-end gap-3">
          {["sm", "md", "lg", "xl"].map((step) => (
            <span key={step} className="flex flex-col items-center gap-1">
              <span className="size-12 border bg-muted" style={{ borderRadius: `var(--radius-${step})` }} />
              <span className="font-mono text-[11px] text-muted-foreground">{step}</span>
            </span>
          ))}
          <span className="flex flex-col items-center gap-1">
            <span className="size-12 rounded-full border bg-muted" />
            <span className="font-mono text-[11px] text-muted-foreground">full</span>
          </span>
        </div>
      ),
    },
    {
      name: "type",
      origin: "product",
      from: "src/index.css",
      symbol: "--font-display / --font-sans / --font-mono",
      what: "Four sizes and no more. A fifth is a heading somebody invented.",
      note: (
        <>
          ⚠️ <strong>`font-display` is for a page title only.</strong> Everything else is the body face, and a
          screen where three things want to be the title is a screen with no title.
        </>
      ),
      render: () => (
        <div className="flex flex-col gap-1">
          <span className="font-display text-lg font-semibold tracking-[-0.02em]">Page title · font-display text-lg</span>
          <span className="text-sm font-medium">Section · text-sm font-medium</span>
          <span className="text-xs">Body · text-xs</span>
          <span className="text-[11px] text-muted-foreground">Meta · text-[11px] muted</span>
          <span className="font-mono text-xs">Identifier · font-mono text-xs</span>
        </div>
      ),
    },
  ],
}
