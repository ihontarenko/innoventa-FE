import { http } from "./http"

/**
 * Where a field's choices come from.
 *
 * ⚠️ **The configuration lives on `field_configs` beside `validation.*`**, so pointing a field at a
 * source costs no migration. An absent `options.source` means `static` — every field that existed
 * before sources did.
 */
export const OPTION_SOURCE_KEYS = {
  SOURCE: "options.source",
  /** Everything under this prefix is one of that provider's own parameters. */
  PARAMETER_PREFIX: "options.source.",
} as const

export const STATIC_OPTION_SOURCE = "static"

/**
 * The `value_field` naming the entry's own identifier rather than one of its fields.
 *
 * ⚠️ A reserved token, and it has to be: an identifier is not a row in `fields`, so no field name could
 * stand for it.
 */
export const IDENTITY_VALUE = ":id"

/** What an identity that has lost what it pointed at reads as. Mirrors the backend's `OptionLabels`. */
export const TOMBSTONE_LABEL = "‹deleted›"

/**
 * How a parameter is edited.
 *
 * ⚠️ **Additive on the server**, so anything this list has not heard of falls back to a text input
 * rather than breaking the editor — a new kind must cost a plainer control, never a blank screen.
 */
export type OptionParameterKind =
  | "TEXT"
  | "EXPRESSION"
  | "FORM"
  | "FIELD_OF"
  | "KEY_FIELD"
  | "CHOICE"
  | (string & NonNullable<unknown>)

export interface OptionChoice {
  value: string
  label: string
  /** What choosing it means, in the source's own words. */
  consequence: string
}

export interface OptionParameter {
  name: string
  label: string
  kind: OptionParameterKind
  required: boolean
  /** For `FIELD_OF` and `KEY_FIELD`: the parameter naming the form whose fields are the candidates. */
  dependsOn: string | null
  /** For `CHOICE`: the values on offer, the first being the default. Empty for every other kind. */
  choices: OptionChoice[]
  hint: string | null
}

export interface OptionSourceDescriptor {
  code: string
  label: string
  description: string
  parameters: OptionParameter[]
}

export interface OptionItem {
  value: string
  label: string
}

/**
 * One page of choices and the honest total.
 *
 * ⚠️ **The widget follows the data.** A plain list while everything fits on one page, a search box once
 * it does not — no source declares which it is, and none should have to.
 */
export interface OptionPage {
  items: OptionItem[]
  total: number
  page: number
  size: number
}

export const optionSourcesApi = {
  /** Every registered source with its typed parameters — the editor is built from this and nothing else. */
  list: () => http.get<OptionSourceDescriptor[]>("/option-sources"),

  optionsFor: (
    fieldId: string,
    request: { query: string | null; draftValues: Record<string, string> },
    page = 0,
    size = 50,
  ) => http.post<OptionPage>(`/fields/${fieldId}/options?page=${page}&size=${size}`, request),

  /** What a configuration would offer, before it is saved onto a field. */
  preview: (
    request: {
      source: string
      parameters: Record<string, string>
      query?: string | null
      draftValues?: Record<string, string>
    },
    page = 0,
    size = 20,
  ) => http.post<OptionPage>(`/option-sources/preview?page=${page}&size=${size}`, request),
}

/** The parameters of a source, pulled out of a field's configuration map. */
export function sourceParametersOf(configs: Record<string, string>): Record<string, string> {
  const parameters: Record<string, string> = {}

  for (const [key, value] of Object.entries(configs)) {
    if (key.startsWith(OPTION_SOURCE_KEYS.PARAMETER_PREFIX)) {
      parameters[key.slice(OPTION_SOURCE_KEYS.PARAMETER_PREFIX.length)] = value
    }
  }

  return parameters
}

/** The configuration key one parameter is stored under. */
export function parameterKey(name: string): string {
  return `${OPTION_SOURCE_KEYS.PARAMETER_PREFIX}${name}`
}
