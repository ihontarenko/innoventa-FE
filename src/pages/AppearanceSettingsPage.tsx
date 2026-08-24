import type { ReactNode } from "react"
import { Check, Snowflake } from "lucide-react"
import { cn, useTheme, type ContrastMode, type FontScale } from "@jmouse/ui"
import { darkThemes, lightThemes, seasonalThemes } from "@jmouse/ui/presets"
import { CodeAppearancePicker } from "@jmouse/codemirror/react"
import { PageHeader } from "@/components/PageHeader"
import { SegmentedControl } from "@/components/SegmentedControl"

const FONT_SCALES: Array<{ value: FontScale; label: string }> = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "xlarge", label: "XL" },
]

const CONTRAST_MODES: Array<{ value: ContrastMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const MODES: Array<{ value: "light" | "dark" | "system"; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

/**
 * Everything the interface looks like, on one screen.
 *
 * ⚠️ **Compact on purpose, and it used to be the opposite.** Every section was a `Card` with its own
 * header, padding and shadow, and the swatch grid stretched to whatever width the display had — on a
 * wide screen a row of five themes spanned two thousand pixels, so choosing one meant crossing the
 * monitor. Six cards for six one-line settings is a page you scroll to find a toggle.
 *
 * What replaced them: one measured column, plain rules between sections rather than boxes, the three
 * one-choice settings (mode, text size, contrast) on a single row, and swatches sized to their labels
 * so the eye can take a palette in at a glance instead of scanning.
 *
 * A page rather than the dropdown it started as, and it stays one: mode, twenty-seven themes, seasonal
 * effects, text size and contrast is a screenful, not a menu. (The positioning that made it a page in
 * the first place is no longer an argument — overlays are anchored by the browser now — but the amount
 * of content still is.)
 */
/**
 * The page at `/settings/appearance`.
 *
 * ⚠️ A thin wrapper over {@link AppearanceSettings}, because the account screen shows the same controls
 * as one of its tabs. Two copies would be two pickers that drift.
 */
export function AppearanceSettingsPage() {
  return (
    <>
      <PageHeader title="Appearance" description="Theme, text size, and contrast" />
      <AppearanceSettings />
    </>
  )
}

export function AppearanceSettings() {
  const {
    mode,
    lightTheme,
    darkTheme,
    fontScale,
    contrastMode,
    seasonalEffectEnabled,
    setMode,
    setLightTheme,
    setDarkTheme,
    setFontScale,
    setContrastMode,
    setSeasonalEffectEnabled,
  } = useTheme()

  return (
    <>
      {/* Measured rather than full-bleed: swatch rows that span an ultra-wide display are unreadable. */}
      <div className="max-w-4xl divide-y pt-2">
        {/* The three single-choice settings share one row — each is a handful of words, and stacking
            them into three sections was three headings for three clicks. */}
        <Row>
          <Field label="Mode">
            <SegmentedControl segments={MODES} value={mode} onChange={setMode} ariaLabel="Colour mode" />
          </Field>
          <Field label="Text size">
            <SegmentedControl
              segments={FONT_SCALES}
              value={fontScale}
              onChange={setFontScale}
              ariaLabel="Text size"
            />
          </Field>
          <Field label="Contrast">
            <SegmentedControl
              segments={CONTRAST_MODES}
              value={contrastMode}
              onChange={setContrastMode}
              ariaLabel="Contrast"
            />
          </Field>
        </Row>

        <Section title="Light theme">
          <SwatchGrid>
            {lightThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={lightTheme === theme.name}
                onClick={() => setLightTheme(theme.name)}
              />
            ))}
          </SwatchGrid>
        </Section>

        <Section title="Dark theme">
          <SwatchGrid>
            {darkThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={darkTheme === theme.name}
                onClick={() => setDarkTheme(theme.name)}
              />
            ))}
          </SwatchGrid>
        </Section>


        {/* ⚠️ The picker is the library's, not this page's. Palette and code theme mean the same
            thing in every interface, and a copy per product is how five of them came to render the
            same policy five ways. */}
        <div className="[&>section]:border-t [&>section:first-child]:border-t-0">
          <CodeAppearancePicker />
        </div>

        <Section title="Seasonal">
          <SwatchGrid>
            {seasonalThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={(theme.dark ? darkTheme : lightTheme) === theme.name}
                onClick={() => (theme.dark ? setDarkTheme(theme.name) : setLightTheme(theme.name))}
              />
            ))}
          </SwatchGrid>
          <SeasonalEffectsToggle
            enabled={seasonalEffectEnabled}
            onToggle={() => setSeasonalEffectEnabled(!seasonalEffectEnabled)}
          />
        </Section>
      </div>
    </>
  )
}

/** A row of side-by-side settings, wrapping on narrow displays. */
function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-x-8 gap-y-4 py-3">{children}</div>
}

/** One labelled control — the label is small and above, so the control itself is what the eye lands on. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-3">
      <h2 className="mb-2 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Swatches sized to their labels rather than stretched to a column width.
 *
 * `auto-fill` with a small floor means a wide display fits more per row instead of making each one
 * wider — which is what turned this page into a scroll on a large monitor.
 */
function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5">{children}</div>
}

function Swatch({
  label,
  color,
  selected,
  onClick,
}: {
  label: string
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={chipClassName(selected)}
    >
      <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="size-3.5 shrink-0" />}
    </button>
  )
}

/**
 * The one chip shape this page speaks in.
 *
 * A palette and the seasonal-effects toggle are different settings, but on the screen they are the
 * same object — a bordered pill that is either chosen or not — so the border, the padding and the
 * chosen state come from here rather than from each caller.
 */
function chipClassName(selected: boolean) {
  return cn(
    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
    selected ? "border-primary bg-accent text-accent-foreground" : "hover:bg-accent",
  )
}

/**
 * Seasonal effects, drawn as one of the chips above rather than as a switch.
 *
 * ⚠️ **It was a bare `<label>` with a `Switch` hanging off the end of it** — the only unbordered
 * control in a section made entirely of bordered chips, which is what made a small toggle read as the
 * heaviest thing in it. Same shape now, and the same vocabulary for on: `border-primary` and a
 * `Check`, exactly as a chosen palette says it.
 *
 * ⚠️ Sized to its own label rather than dropped into {@link SwatchGrid} — the grid's 9rem column is cut
 * to a palette's one-word name, and it truncated this one to "Seasonal eff…".
 */
function SeasonalEffectsToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(chipClassName(enabled), "mt-1.5 w-fit")}
    >
      <Snowflake className={cn("size-3 shrink-0", !enabled && "text-muted-foreground")} />
      <span>Seasonal effects</span>
      {enabled && <Check className="size-3.5 shrink-0" />}
    </button>
  )
}
