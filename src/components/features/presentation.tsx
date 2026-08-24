import { cn } from "@jmouse/ui"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { INERT_SURFACE } from "@/components/markdown/surface"
import { evaluateOperator } from "@/lib/formConditions"
import { WidgetEmpty, WidgetField, WidgetInputs, WidgetText, WidgetTextarea } from "./WidgetKit"
import { LEVEL_TEXT, levelOf } from "./levels"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

/**
 * The three form-bound widgets that *present* an answer rather than measure one.
 *
 * A colour, a piece of prose, a graded quiz — nothing here computes a level from a magnitude, which is
 * what separates them from the indicators next door.
 */

// ── Colour swatch ────────────────────────────────────────────────────────────

interface Rgb {
  red: number
  green: number
  blue: number
}

/** ⚠️ Six hex digits only. Three-digit shorthand and named colours are *not* what a colour field stores. */
function hexToRgb(hex: string): Rgb | null {
  const cleaned = hex.replace("#", "")

  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return null
  }

  return {
    red: Number.parseInt(cleaned.slice(0, 2), 16),
    green: Number.parseInt(cleaned.slice(2, 4), 16),
    blue: Number.parseInt(cleaned.slice(4, 6), 16),
  }
}

function rgbToHsl({ red, green, blue }: Rgb) {
  const [r, g, b] = [red / 255, green / 255, blue / 255]
  const maximum = Math.max(r, g, b)
  const minimum = Math.min(r, g, b)
  const lightness = (maximum + minimum) / 2

  if (maximum === minimum) {
    return { hue: 0, saturation: 0, lightness: Math.round(lightness * 100) }
  }

  const delta = maximum - minimum
  const saturation = lightness > 0.5 ? delta / (2 - maximum - minimum) : delta / (maximum + minimum)

  const hue =
    maximum === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
      : maximum === g
        ? ((b - r) / delta + 2) / 6
        : ((r - g) / delta + 4) / 6

  return {
    hue: Math.round(hue * 360),
    saturation: Math.round(saturation * 100),
    lightness: Math.round(lightness * 100),
  }
}

/**
 * ⚠️ **The breakdowns are the reason this is a widget rather than a coloured square.** Somebody looking
 * at a stored colour is usually about to type it somewhere else, and the somewhere else wants RGB or
 * HSL — reading it off the hex by hand is the job this saves.
 */
export function ColorSwatchWidget({ values }: WidgetProperties) {
  const raw = (values.color ?? "").trim()
  const rgb = hexToRgb(raw)

  if (!rgb) {
    return (
      <WidgetEmpty>
        {raw ? (
          <>
            <span className="font-mono">{raw}</span> is not a six-digit hex colour.
          </>
        ) : (
          "No colour is mapped to this widget yet."
        )}
      </WidgetEmpty>
    )
  }

  const hsl = rgbToHsl(rgb)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        aria-hidden="true"
        className="size-14 shrink-0 rounded-md border"
        style={{ background: raw.startsWith("#") ? raw : `#${raw}` }}
      />

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 font-mono text-xs">
        <dt className="text-muted-foreground">HEX</dt>
        <dd className="uppercase">{raw.startsWith("#") ? raw : `#${raw}`}</dd>
        <dt className="text-muted-foreground">RGB</dt>
        <dd>
          {rgb.red}, {rgb.green}, {rgb.blue}
        </dd>
        <dt className="text-muted-foreground">HSL</dt>
        <dd>
          {hsl.hue}°, {hsl.saturation}%, {hsl.lightness}%
        </dd>
      </dl>
    </div>
  )
}

export function ColorSwatchInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Colour" hint="Six hex digits.">
        <WidgetText mono value={values.color ?? ""} placeholder="#3b82f6" onChange={(next) => onChange("color", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Markdown preview ─────────────────────────────────────────────────────────

/**
 * ⚠️ **The real renderer, on the inert surface.** A widget on a form has no page share token and no
 * business resolving live data — so the client directives (diagrams, callouts, maths) render and the
 * server ones say they are unavailable, which is exactly what `INERT_SURFACE` means.
 */
export function MarkdownPreviewWidget({ values }: WidgetProperties) {
  const text = values.text ?? ""

  if (!text.trim()) {
    return <WidgetEmpty>No text is mapped to this widget yet.</WidgetEmpty>
  }

  return <PageMarkdown markdown={text} surface={INERT_SURFACE} dense />
}

export function MarkdownPreviewInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Markdown" className="w-full">
        <WidgetTextarea rows={6} value={values.text ?? ""} onChange={(next) => onChange("text", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Quiz result ──────────────────────────────────────────────────────────────

/**
 * A form graded against the answers its author declared.
 *
 * ⚠️ **The rules live on the *bindings*, not in this widget's values.** Each mapping carries an operator
 * and an expected value, so a quiz's questions are configured where the form is — which is why this is
 * the one widget with `dynamicSlots` and why it reads `fieldMappings` rather than `values` for its
 * structure.
 *
 * ⚠️ **A wrong answer says what was expected; a right one does not.** Showing the expected value beside
 * a correct answer teaches nothing and, on a quiz somebody is about to retake, gives the game away.
 */
export function QuizResultWidget({ values, fieldMappings }: WidgetProperties) {
  const rules = fieldMappings.filter(
    (mapping) => mapping.operator && mapping.expectedValue !== undefined && mapping.expectedValue !== "",
  )

  if (rules.length === 0) {
    return (
      <WidgetEmpty>
        No rules yet. Open the form's widgets panel and give each question an expected answer.
      </WidgetEmpty>
    )
  }

  const graded = rules.map((rule) => ({
    rule,
    given: values[rule.inputKey] ?? "",
    isCorrect: evaluateOperator(rule.operator!, values[rule.inputKey] ?? "", rule.expectedValue!),
  }))

  const correct = graded.filter((one) => one.isCorrect).length
  const level = levelOf(correct / graded.length)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-2xl font-medium", LEVEL_TEXT[level])}>
          {correct} / {graded.length}
        </span>
        <span className={cn("font-mono text-sm", LEVEL_TEXT[level])}>
          {Math.round((correct / graded.length) * 100)}%
        </span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {graded.map((one, index) => (
          <li
            key={one.rule.inputKey}
            className={cn(
              "flex flex-wrap items-baseline gap-2 rounded-md px-2 py-1 text-xs",
              one.isCorrect ? "bg-emerald-500/10" : "bg-destructive/10",
            )}
          >
            <span aria-hidden="true">{one.isCorrect ? "✓" : "✗"}</span>
            <span className="text-muted-foreground">#{index + 1}</span>
            <span className="font-mono">{one.given || <em className="text-muted-foreground">no answer</em>}</span>
            {!one.isCorrect && (
              <span className="ml-auto font-mono text-muted-foreground">expected {one.rule.expectedValue}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function QuizResultInputs({ values, onChange }: WidgetInputsProperties) {
  const keys = Object.keys(values)

  if (keys.length === 0) {
    return (
      <WidgetEmpty>
        This one has no inputs of its own — its questions come from the form it is bound to, and its
        answers from the rules on each binding.
      </WidgetEmpty>
    )
  }

  return (
    <WidgetInputs>
      {keys.map((key) => (
        <WidgetField key={key} label={key}>
          <WidgetText value={values[key] ?? ""} onChange={(next) => onChange(key, next)} />
        </WidgetField>
      ))}
    </WidgetInputs>
  )
}
