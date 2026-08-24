import type { ComponentType } from "react"

/**
 * What a feature is told when it draws.
 *
 * ⚠️ **`values` is keyed by the feature's own *input keys*, never by field names.** A feature declares
 * slots — `quantity`, `minimum` — and the form binding says which of *its* fields fills each one. That
 * indirection is the whole reason one widget works on twenty different forms.
 */
export interface WidgetProperties {
  values: Record<string, string>
  fieldMappings: FeatureFieldMapping[]
}

/** Which of a form's fields fills one of a feature's slots. */
export interface FeatureFieldMapping {
  inputKey: string
  fieldName: string
  /** A condition on the mapping — the widget draws only when the field satisfies it. */
  operator?: string
  expectedValue?: string
}

/** The panel that configures a feature outside a form — on the Tools page, or in a preview. */
export interface WidgetInputsProperties {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

/** What a standalone feature says about itself when no catalogue row describes it. */
export interface FeatureMeta {
  name: string
  description: string
  category: string
}

/**
 * One entry of the feature registry.
 *
 * ⚠️ **`kind` decides where it can appear and is not a label.** A `widget` binds to a form and never
 * shows on Tools; a `tool` stands alone and never binds; an `aggregator` reads across every entry of a
 * form. Getting this wrong puts a stock indicator on the Tools page with nothing to indicate.
 */
export interface FeatureEntry {
  slug: string
  widget: ComponentType<WidgetProperties>
  inputs: ComponentType<WidgetInputsProperties>
  defaultValues: Record<string, string>
  /** The feature builds its own slots at runtime — a quiz's questions, an aggregator's fields. */
  dynamicSlots?: boolean
  kind: "widget" | "tool" | "aggregator"
  /** ⚠️ Fallback for a feature with no catalogue row. Three of them have none and are fine. */
  meta?: FeatureMeta
}
