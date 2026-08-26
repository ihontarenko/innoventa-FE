/**
 * A form's configuration, read by name instead of by string key.
 *
 * ⚠️ **The keys live in `formConfigCatalogue.ts` and are typed here.** The catalogue is what the editor
 * renders; this is what the screens read. Two files rather than one because they answer different
 * questions — *what may be set* versus *what does this form say* — and a screen that reached into the
 * catalogue to read a value would be walking a UI description to find data.
 *
 * ⚠️ **Every getter answers `null` or an empty list, never `undefined`.** A form carries only the keys
 * somebody set, so "unset" is the ordinary case and has to read like one at every call site.
 */
export const FORM_CONFIG_KEYS = {
  PRIMARY_FIELD: "display.primary_field",
  SECONDARY_FIELD: "display.secondary_field",
  IMAGE_FIELD: "display.image_field",
  COLOUR_FIELD: "display.color_field",
  PRIORITY_FIELDS: "display.priority_fields",
  TABLE_COLUMNS: "display.table_columns",
  GROUP_BY_FIELD: "display.group_by_field",
  SORT_FIELD: "display.sort_default_field",
  SORT_DIRECTION: "display.sort_default_direction",
  STOCK_QUANTITY_FIELD: "stock.quantity_field",
  STOCK_THRESHOLD_FIELD: "stock.threshold_field",
  STOCK_LOCATION_FIELD: "stock.location_field",
  PRICE_FIELD: "pricing.price_field",
  UNIQUE_FIELD: "validation.unique_field",

  // ⚠️ **These five are read only by the PUBLIC form.** They decide what a stranger sees after pressing
  // the button — the wording, where they are sent, whether they may fill it again — and nothing in the
  // signed-in application looks at any of them.
  SUBMIT_BUTTON_TEXT: "submit.button_text",
  SUBMIT_SUCCESS_MESSAGE: "submit.success_message",
  SUBMIT_SUCCESS_REDIRECT_URL: "submit.success_redirect_url",
  SUBMIT_ALLOW_RESUBMIT: "submit.allow_resubmit",
  ACCENT_COLOUR: "form.accent_color",
} as const

/**
 * Which field of a form means what, when a distributor's answer is written into it.
 *
 * ⚠️ **This is what makes the lookup screen able to fill a form it has never seen.** A component type
 * names its own fields; the offer names manufacturers and part numbers. These keys are the only bridge,
 * and a type that sets none of them simply cannot be filled from a lookup — which is a thing to say on
 * screen rather than a thing to guess at.
 */
export const PRICING_CONFIG_KEYS = {
  NAME_FIELD: "pricing.name_field",
  PRICE_FIELD: "pricing.price_field",
  PART_NUMBER_FIELD: "pricing.part_number_field",
  MANUFACTURER_FIELD: "pricing.manufacturer_field",
  DESCRIPTION_FIELD: "pricing.description_field",
  DATASHEET_URL_FIELD: "pricing.datasheet_url_field",
  DATASHEET_FILE_FIELD: "pricing.datasheet_file_field",
  BUY_URL_FIELD: "pricing.buy_url_field",
  IMAGE_URL_FIELD: "pricing.image_url_field",
} as const

/** A comma-separated key, split and trimmed. ⚠️ Empty segments dropped — a trailing comma is not a field. */
function nameList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

export interface FormConfigs {
  /** The field an entry is *called by*. ⚠️ Falls back to the form's first field at the call site, not here. */
  primaryField: string | null
  secondaryField: string | null
  imageField: string | null
  colourField: string | null
  priorityFields: string[]
  /** ⚠️ When set this **is** the column list — it wins over the priority fields and over the fallback. */
  tableColumns: string[]
  stockQuantityField: string | null
  stockThresholdField: string | null
  /** Where the thing is. Points at a field, which may itself be sourced from the Locations catalogue. */
  stockLocationField: string | null
  priceField: string | null
  /** Whether anything at all has been said about how to display this form. */
  hasDisplayConfig: boolean

  /** What the public form's button says, and what happens once it has been pressed. */
  submission: PublicSubmissionConfigs
}

export interface PublicSubmissionConfigs {
  buttonText: string | null
  successMessage: string | null
  /**
   * ⚠️ **Somewhere else entirely, off this product.** Set, it replaces the thank-you screen with a
   * navigation — so it is the one config key here that can take a respondent away from Innoventa, and it
   * fires only after the entry is safely written.
   */
  successRedirectUrl: string | null
  allowResubmit: boolean
  /** A form's own colour, applied as `--primary` for the public page only. */
  accentColour: string | null
}

export function readFormConfigs(values: Record<string, string> | null | undefined): FormConfigs {
  const map = values ?? {}
  const text = (key: string) => map[key]?.trim() || null

  const primaryField = text(FORM_CONFIG_KEYS.PRIMARY_FIELD)
  const secondaryField = text(FORM_CONFIG_KEYS.SECONDARY_FIELD)
  const imageField = text(FORM_CONFIG_KEYS.IMAGE_FIELD)
  const priorityFields = nameList(map[FORM_CONFIG_KEYS.PRIORITY_FIELDS])

  return {
    primaryField,
    secondaryField,
    imageField,
    colourField: text(FORM_CONFIG_KEYS.COLOUR_FIELD),
    priorityFields,
    tableColumns: nameList(map[FORM_CONFIG_KEYS.TABLE_COLUMNS]),
    stockQuantityField: text(FORM_CONFIG_KEYS.STOCK_QUANTITY_FIELD),
    stockThresholdField: text(FORM_CONFIG_KEYS.STOCK_THRESHOLD_FIELD),
    stockLocationField: text(FORM_CONFIG_KEYS.STOCK_LOCATION_FIELD),
    priceField: text(FORM_CONFIG_KEYS.PRICE_FIELD),
    hasDisplayConfig: !!primaryField || !!secondaryField || !!imageField || priorityFields.length > 0,
    submission: {
      buttonText: text(FORM_CONFIG_KEYS.SUBMIT_BUTTON_TEXT),
      successMessage: text(FORM_CONFIG_KEYS.SUBMIT_SUCCESS_MESSAGE),
      successRedirectUrl: text(FORM_CONFIG_KEYS.SUBMIT_SUCCESS_REDIRECT_URL),
      allowResubmit: map[FORM_CONFIG_KEYS.SUBMIT_ALLOW_RESUBMIT] === "true",
      accentColour: text(FORM_CONFIG_KEYS.ACCENT_COLOUR),
    },
  }
}
