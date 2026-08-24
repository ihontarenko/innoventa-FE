import { cn } from "@jmouse/ui"
import { WidgetEmpty, WidgetField, WidgetInputs, WidgetNumber } from "./WidgetKit"
import { LEVEL_COLOUR, LEVEL_TEXT, levelOf } from "./levels"
import { parseNumber } from "./shared"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

/**
 * The six form-bound indicators: one number, read at a glance.
 *
 * ⚠️ **Together in one file because they are one idea six times.** Each takes a value and a ceiling,
 * turns them into a fraction and paints it — and when they lived in six folders they drifted: three
 * different amber thresholds, two different roundings, one that clamped and one that did not. What
 * genuinely differs between them is the *drawing*, and that is all each function below contains.
 *
 * ⚠️ **Every one clamps.** A stored value above its ceiling is a data problem, not a licence to draw an
 * arc past its own end or a bar out of its container.
 */

// ── Score gauge ──────────────────────────────────────────────────────────────

const GAUGE_SIZE = 128
const GAUGE_RADIUS = 50
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS
/** ⚠️ Three quarters of a circle, opening downwards — a full ring has no start and reads as a pie. */
const GAUGE_ARC = GAUGE_CIRCUMFERENCE * 0.75

export function ScoreGaugeWidget({ values }: WidgetProperties) {
  const score = parseNumber(values.score)
  const ceiling = parseNumber(values.max_score) ?? 100

  if (score === null) {
    return <WidgetEmpty>No score is mapped to this widget yet.</WidgetEmpty>
  }

  const clamped = Math.min(Math.max(score, 0), ceiling)
  const fraction = ceiling > 0 ? clamped / ceiling : 0
  const level = levelOf(fraction)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={GAUGE_SIZE}
        height={GAUGE_SIZE}
        viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
        role="img"
        aria-label={`${score} out of ${ceiling}`}
      >
        <g transform={`rotate(135 ${GAUGE_SIZE / 2} ${GAUGE_SIZE / 2})`}>
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={GAUGE_RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`}
          />
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={GAUGE_RADIUS}
            fill="none"
            stroke={LEVEL_COLOUR[level]}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${fraction * GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`}
          />
        </g>

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-mono text-xl font-medium"
        >
          {Math.round(fraction * 100)}%
        </text>
      </svg>

      <span className="font-mono text-xs text-muted-foreground">
        {score} / {ceiling}
      </span>
    </div>
  )
}

export function ScoreGaugeInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Score">
        <WidgetNumber value={values.score ?? ""} onChange={(next) => onChange("score", next)} />
      </WidgetField>
      <WidgetField label="Out of">
        <WidgetNumber value={values.max_score ?? ""} onChange={(next) => onChange("max_score", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Percentage bar ───────────────────────────────────────────────────────────

export function PercentageBarWidget({ values }: WidgetProperties) {
  const value = parseNumber(values.value)
  const total = parseNumber(values.total) ?? 100

  if (value === null) {
    return <WidgetEmpty>No value is mapped to this widget yet.</WidgetEmpty>
  }

  const clamped = Math.min(Math.max(value, 0), total)
  const fraction = total > 0 ? clamped / total : 0
  const level = levelOf(fraction)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between font-mono text-xs">
        <span>
          {value} <span className="text-muted-foreground">of {total}</span>
        </span>
        <span className={cn("font-medium", LEVEL_TEXT[level])}>{Math.round(fraction * 100)}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${fraction * 100}%`, background: LEVEL_COLOUR[level] }}
        />
      </div>
    </div>
  )
}

export function PercentageBarInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Value">
        <WidgetNumber value={values.value ?? ""} onChange={(next) => onChange("value", next)} />
      </WidgetField>
      <WidgetField label="Of">
        <WidgetNumber value={values.total ?? ""} onChange={(next) => onChange("total", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Stock status ─────────────────────────────────────────────────────────────

/**
 * ⚠️ **Three states, and "out" is not "very low".** Zero on hand is a different instruction from two
 * left: one means order, the other means order *now* — and a scale that shaded from green to red would
 * make the difference a matter of how red.
 */
export function StockStatusWidget({ values }: WidgetProperties) {
  const quantity = parseNumber(values.quantity)
  const minimum = parseNumber(values.minimum)

  if (quantity === null) {
    return <WidgetEmpty>No quantity is mapped to this widget yet.</WidgetEmpty>
  }

  const level = quantity <= 0 ? "poor" : minimum !== null && quantity <= minimum ? "middling" : "good"
  const label = quantity <= 0 ? "Out of stock" : level === "middling" ? "Low stock" : "In stock"

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium text-background"
        style={{ background: LEVEL_COLOUR[level] }}
      >
        {label}
      </span>
      <span className="font-mono text-lg font-medium">{quantity}</span>
      <span className="text-xs text-muted-foreground">
        on hand
        {minimum !== null && ` · min ${minimum}`}
      </span>
    </div>
  )
}

export function StockStatusInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Quantity">
        <WidgetNumber value={values.quantity ?? ""} onChange={(next) => onChange("quantity", next)} />
      </WidgetField>
      <WidgetField label="Low below">
        <WidgetNumber value={values.minimum ?? ""} onChange={(next) => onChange("minimum", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Days of supply ───────────────────────────────────────────────────────────

/**
 * ⚠️ **A daily usage of zero is "forever", not a division by zero.** Something nobody consumes never
 * runs out, and the honest answer is the word rather than an infinity symbol or a blank.
 */
export function DaysOfSupplyWidget({ values }: WidgetProperties) {
  const quantity = parseNumber(values.quantity)
  const dailyUsage = parseNumber(values.daily_usage)

  if (quantity === null || dailyUsage === null) {
    return <WidgetEmpty>Both a quantity and a daily usage are needed here.</WidgetEmpty>
  }

  if (dailyUsage <= 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-medium">∞</span>
        <span className="text-xs text-muted-foreground">nothing is being used</span>
      </div>
    )
  }

  const days = quantity / dailyUsage
  // ⚠️ Under a fortnight is poor, under a month is middling. A supply figure is read to decide whether
  // to order today, and the ordinary lead time is what makes a fortnight the line.
  const level = days >= 30 ? "good" : days >= 14 ? "middling" : "poor"

  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-baseline gap-2">
        <span className={cn("font-mono text-2xl font-medium", LEVEL_TEXT[level])}>{Math.floor(days)}</span>
        <span className="text-xs text-muted-foreground">days of supply</span>
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {quantity} ÷ {dailyUsage} a day
      </span>
    </div>
  )
}

export function DaysOfSupplyInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="On hand">
        <WidgetNumber value={values.quantity ?? ""} onChange={(next) => onChange("quantity", next)} />
      </WidgetField>
      <WidgetField label="Used per day">
        <WidgetNumber value={values.daily_usage ?? ""} onChange={(next) => onChange("daily_usage", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Star rating ──────────────────────────────────────────────────────────────

/**
 * ⚠️ **Half stars are drawn, not rounded away.** 3.5 rounded to 4 is a rating this widget invented, and
 * on a five-point scale that is a tenth of the whole range.
 */
export function StarRatingDisplayWidget({ values }: WidgetProperties) {
  const rating = parseNumber(values.rating)
  const maximum = parseNumber(values.max_stars) ?? 5

  if (rating === null) {
    return <WidgetEmpty>No rating is mapped to this widget yet.</WidgetEmpty>
  }

  const clamped = Math.min(Math.max(rating, 0), maximum)

  return (
    <div className="flex items-center gap-2">
      <span className="flex" role="img" aria-label={`${clamped} out of ${maximum}`}>
        {Array.from({ length: Math.round(maximum) }, (_unused, index) => {
          const filled = Math.min(Math.max(clamped - index, 0), 1)

          return (
            <span key={index} className="relative text-lg leading-none text-muted-foreground/40">
              ★
              <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden text-amber-500"
                style={{ width: `${filled * 100}%` }}
              >
                ★
              </span>
            </span>
          )
        })}
      </span>

      <span className="font-mono text-xs text-muted-foreground">
        {clamped} / {maximum}
      </span>
    </div>
  )
}

export function StarRatingDisplayInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Rating">
        <WidgetNumber step="0.5" value={values.rating ?? ""} onChange={(next) => onChange("rating", next)} />
      </WidgetField>
      <WidgetField label="Out of">
        <WidgetNumber value={values.max_stars ?? ""} onChange={(next) => onChange("max_stars", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}

// ── NPS ──────────────────────────────────────────────────────────────────────

/**
 * ⚠️ **The NPS bands are not a scale, they are a definition.** 0–6 detractor, 7–8 passive, 9–10
 * promoter — that is what the measure *is*, so this one widget does not use `levelOf`: a threshold at
 * 70 % would put an 8 in the wrong band and quietly redefine somebody's metric.
 */
function npsBand(score: number): { label: string; tone: "good" | "middling" | "poor" } {
  if (score >= 9) {
    return { label: "Promoter", tone: "good" }
  }

  return score >= 7 ? { label: "Passive", tone: "middling" } : { label: "Detractor", tone: "poor" }
}

export function NpsIndicatorWidget({ values }: WidgetProperties) {
  const score = parseNumber(values.score)

  if (score === null) {
    return <WidgetEmpty>No score is mapped to this widget yet.</WidgetEmpty>
  }

  const clamped = Math.min(Math.max(Math.round(score), 0), 10)
  const band = npsBand(clamped)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-2xl font-medium", LEVEL_TEXT[band.tone])}>{clamped}</span>
        <span className="text-xs text-muted-foreground">{band.label}</span>
      </div>

      <div className="flex gap-0.5">
        {Array.from({ length: 11 }, (_unused, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full", index === clamped ? "" : "bg-muted")}
            style={index === clamped ? { background: LEVEL_COLOUR[band.tone] } : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export function NpsIndicatorInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Score" hint="0 – 10">
        <WidgetNumber value={values.score ?? ""} onChange={(next) => onChange("score", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}
