import { AwgWireInputs, AwgWireWidget, ComponentCodeConverterInputs, ComponentCodeConverterWidget, LcResonantInputs, LcResonantWidget } from "./tools"
import { CapacitorVisualInputs, CapacitorVisualWidget, ResistorColorCodeInputs, ResistorColorCodeWidget } from "./components"
import { EntryAggregatorInputs, EntryAggregatorWidget } from "./EntryAggregator"
import { LogicGateInputs, LogicGateWidget } from "./LogicGate"
import {
  DaysOfSupplyInputs,
  DaysOfSupplyWidget,
  NpsIndicatorInputs,
  NpsIndicatorWidget,
  PercentageBarInputs,
  PercentageBarWidget,
  ScoreGaugeInputs,
  ScoreGaugeWidget,
  StarRatingDisplayInputs,
  StarRatingDisplayWidget,
  StockStatusInputs,
  StockStatusWidget,
} from "./indicators"
import {
  ColorSwatchInputs,
  ColorSwatchWidget,
  MarkdownPreviewInputs,
  MarkdownPreviewWidget,
  QuizResultInputs,
  QuizResultWidget,
} from "./presentation"
import type { FeatureEntry } from "./contract"

/**
 * Every feature this product has, and the only list of them.
 *
 * ⚠️ **Sixteen, down from twenty-five, and the cull had a rule** (`INVT-0079`, Ivan 2026-08-19): **a
 * one-formula calculator is not a feature, it is a jME expression somebody has not written yet.** Ohm's
 * law, the voltage divider, the LED series resistor and the RC time constant went for that reason; the
 * E-series table went because the parametric search already answers it. What survives is what an
 * expression cannot draw — a truth table, a wire chart, a decoded marking, a distribution.
 *
 * ⚠️ **The registry is the authority, and the database is not.** The Tools page renders from this list
 * and matches a catalogue row by slug, so a row for a feature no longer here is invisible rather than
 * broken — which is what makes deleting one safe. Three of the entries below have no catalogue row at
 * all and carry their own `meta` instead.
 */
const REGISTRY: FeatureEntry[] = [
  // ── Form-bound display widgets ─────────────────────────────────────────────
  {
    slug: "resistor-color-code",
    widget: ResistorColorCodeWidget,
    inputs: ResistorColorCodeInputs,
    defaultValues: { resistance: "4700", unit: "Ω", tolerance: "5%" },
    kind: "widget",
  },
  {
    slug: "capacitor-visual",
    widget: CapacitorVisualWidget,
    inputs: CapacitorVisualInputs,
    defaultValues: { capacitance: "100µF", voltage_rating: "25V" },
    kind: "widget",
  },
  {
    slug: "stock-status",
    widget: StockStatusWidget,
    inputs: StockStatusInputs,
    defaultValues: { quantity: "12", minimum: "5" },
    kind: "widget",
  },
  {
    slug: "days-of-supply",
    widget: DaysOfSupplyWidget,
    inputs: DaysOfSupplyInputs,
    defaultValues: { quantity: "150", daily_usage: "5" },
    kind: "widget",
  },
  {
    slug: "score-gauge",
    widget: ScoreGaugeWidget,
    inputs: ScoreGaugeInputs,
    defaultValues: { score: "78", max_score: "100" },
    kind: "widget",
  },
  {
    slug: "percentage-bar",
    widget: PercentageBarWidget,
    inputs: PercentageBarInputs,
    defaultValues: { value: "73", total: "100" },
    kind: "widget",
  },
  {
    slug: "star-rating-display",
    widget: StarRatingDisplayWidget,
    inputs: StarRatingDisplayInputs,
    defaultValues: { rating: "3.5", max_stars: "5" },
    kind: "widget",
  },
  {
    slug: "nps-indicator",
    widget: NpsIndicatorWidget,
    inputs: NpsIndicatorInputs,
    defaultValues: { score: "8" },
    kind: "widget",
  },
  {
    slug: "color-swatch",
    widget: ColorSwatchWidget,
    inputs: ColorSwatchInputs,
    defaultValues: { color: "#3b82f6" },
    kind: "widget",
  },
  {
    slug: "markdown-preview",
    widget: MarkdownPreviewWidget,
    inputs: MarkdownPreviewInputs,
    defaultValues: { text: "# Hello\n\nThis is **bold** and *italic* text.\n\n- Item one\n- Item two" },
    kind: "widget",
  },
  {
    slug: "quiz-result",
    widget: QuizResultWidget,
    inputs: QuizResultInputs,
    defaultValues: {},
    dynamicSlots: true,
    kind: "widget",
  },

  // ── Standalone tools ───────────────────────────────────────────────────────
  //
  // ⚠️ Each does something an expression cannot: a truth table, four coupled results, a chart, a view of
  // the value interpreter.
  {
    slug: "logic-gate",
    widget: LogicGateWidget,
    inputs: LogicGateInputs,
    defaultValues: { gate_type: "AND", input_a: "0", input_b: "0" },
    kind: "tool",
    meta: {
      name: "Logic gate",
      description: "AND, OR, NOT, NAND, NOR, XOR and XNOR, drawn with a live truth table.",
      category: "VISUALIZER",
    },
  },
  {
    slug: "lc-resonant",
    widget: LcResonantWidget,
    inputs: LcResonantInputs,
    defaultValues: { inductance: "10", inductance_unit: "mH", capacitance: "100", capacitance_unit: "nF" },
    kind: "tool",
    meta: {
      name: "LC resonance",
      description: "Resonant and angular frequency, reactance, period and characteristic impedance for an LC tank.",
      category: "CALCULATOR",
    },
  },
  {
    slug: "awg-wire",
    widget: AwgWireWidget,
    inputs: AwgWireInputs,
    defaultValues: { awg: "22" },
    kind: "tool",
    meta: {
      name: "AWG wire guide",
      description: "Diameter, cross-section, resistance per metre and both maximum-current ratings for every gauge.",
      category: "CONVERTER",
    },
  },
  {
    slug: "component-code-converter",
    widget: ComponentCodeConverterWidget,
    inputs: ComponentCodeConverterInputs,
    defaultValues: { query: "" },
    kind: "tool",
    meta: {
      name: "Component code converter",
      description: "What a marking means, in every form that value takes — EIA-96, SMD codes, colour bands, prefixes.",
      category: "CONVERTER",
    },
  },

  // ── Aggregators ────────────────────────────────────────────────────────────
  {
    slug: "entry-aggregator",
    widget: EntryAggregatorWidget,
    inputs: EntryAggregatorInputs,
    defaultValues: { form_id: "", field_count: "1", field_1: "" },
    dynamicSlots: true,
    kind: "aggregator",
    meta: {
      name: "Entry aggregator",
      description: "How a form's answers are distributed across any of its fields, as a bar chart per field.",
      category: "VISUALIZER",
    },
  },
]

export function featureBySlug(slug: string): FeatureEntry | undefined {
  return REGISTRY.find((entry) => entry.slug === slug)
}

export function allFeatures(): FeatureEntry[] {
  return REGISTRY
}

/** ⚠️ Form-bound only — these never appear on the Tools page, and a tool never binds to a form. */
export function formFeatures(): FeatureEntry[] {
  return REGISTRY.filter((entry) => entry.kind === "widget")
}

export function toolFeatures(): FeatureEntry[] {
  return REGISTRY.filter((entry) => entry.kind === "tool")
}

export function aggregatorFeatures(): FeatureEntry[] {
  return REGISTRY.filter((entry) => entry.kind === "aggregator")
}
