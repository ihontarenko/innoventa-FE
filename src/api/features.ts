import { http } from "./http"

export type FeatureCategory = "VISUALIZER" | "CALCULATOR" | "VALIDATOR" | "CONVERTER" | "LOOKUP"
export type FeatureKind = "WIDGET" | "TOOL" | "AGGREGATOR"

/**
 * One slot a feature declares.
 *
 * ⚠️ **`acceptedFieldTypes` is a comma-separated list, and it is advice rather than a rule.** The panel
 * uses it to put the likely fields first; the backend is what refuses a mapping that cannot work.
 */
export interface FeatureInputSlot {
  inputKey: string
  label: string
  acceptedFieldTypes: string | null
  required: boolean
}

export interface FeatureCatalogItem {
  id: string
  slug: string
  name: string
  description: string | null
  category: FeatureCategory
  kind: FeatureKind
  builtIn: boolean
  inputSlots: FeatureInputSlot[]
}

/** Which of a form's fields fills one of a feature's slots — and, for a quiz, what the right answer is. */
export interface FormFeatureFieldMapping {
  inputKey: string
  fieldName: string
  operator?: string
  expectedValue?: string
}

export interface FormFeatureBinding {
  id: string
  feature: FeatureCatalogItem
  position: number
  fieldMappings: FormFeatureFieldMapping[]
  createdAt: string | null
}

/**
 * The catalogue of features, and what a form has bound.
 *
 * ⚠️ **The catalogue describes; the registry in the browser *implements*.** A row here with no entry in
 * `components/features/registry.ts` renders nothing at all — which is exactly what makes removing a
 * feature from the code safe, and why an orphaned row is not a fault to chase.
 */
export const featuresApi = {
  catalog: (kind?: FeatureKind) => http.get<FeatureCatalogItem[]>("/features", { params: kind ? { kind } : undefined }),

  listForForm: (formId: string) => http.get<FormFeatureBinding[]>(`/forms/${formId}/features`),

  connect: (formId: string, payload: { featureId: string; fieldMappings: FormFeatureFieldMapping[] }) =>
    http.post<FormFeatureBinding>(`/forms/${formId}/features`, payload),

  update: (formId: string, bindingId: string, payload: { fieldMappings: FormFeatureFieldMapping[] }) =>
    http.put<FormFeatureBinding>(`/forms/${formId}/features/${bindingId}`, payload),

  disconnect: (formId: string, bindingId: string) => http.delete<void>(`/forms/${formId}/features/${bindingId}`),
}
