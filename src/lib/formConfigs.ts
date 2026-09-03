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
  /**
   * Which of this type's fields a list may be narrowed by, from the list itself.
   *
   * ⚠️ **An empty list means NOTHING, never everything.** Letting every field filter is an invitation to
   * narrow by a note or by a timestamp to the second, and each of those is a link that leads nowhere
   * anybody wanted to go. The type says what it is worth being asked about.
   *
   * ⚠️ In the `display.*` family rather than `stock.*`: this is a fact about how a type is READ, not
   * about what it means, so the same type filters the same way in the catalogue and in the inventory.
   */
  FILTERABLE_FIELDS: "display.filterable_fields",
  TABLE_COLUMNS: "display.table_columns",
  GROUP_BY_FIELD: "display.group_by_field",
  SORT_FIELD: "display.sort_default_field",
  SORT_DIRECTION: "display.sort_default_direction",
  STOCK_PART_FIELD: "stock.part_field",
  STOCK_QUANTITY_FIELD: "stock.quantity_field",
  STOCK_LOCATION_FIELD: "stock.location_field",
  STOCK_UNIT_FIELD: "stock.unit_field",
  STOCK_THRESHOLD_FIELD: "stock.threshold_field",
  STOCK_PRICE_FIELD: "stock.price_field",
  STOCK_SUPPLIER_FIELD: "stock.supplier_field",
  STOCK_SUPPLIER_SKU_FIELD: "stock.supplier_sku_field",
  STOCK_RECEIVED_AT_FIELD: "stock.received_at_field",
  STOCK_NOTE_FIELD: "stock.note_field",

  PRICE_FIELD: "catalogue.price_field",
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
  NAME_FIELD: "catalogue.name_field",
  PRICE_FIELD: "catalogue.price_field",
  PART_NUMBER_FIELD: "catalogue.part_number_field",
  MANUFACTURER_FIELD: "catalogue.manufacturer_field",
  DESCRIPTION_FIELD: "catalogue.description_field",
  DATASHEET_URL_FIELD: "catalogue.datasheet_url_field",
  DATASHEET_FILE_FIELD: "catalogue.datasheet_file_field",
  BUY_URL_FIELD: "catalogue.buy_url_field",
  IMAGE_URL_FIELD: "catalogue.image_url_field",
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
  /**
   * The fields a list may be narrowed by from a row — see {@link FORM_CONFIG_KEYS.FILTERABLE_FIELDS}.
   *
   * ⚠️ Empty is the ordinary answer and means no cell in this type's table offers a filter.
   */
  filterableFields: string[]
  /** ⚠️ When set this **is** the column list — it wins over the priority fields and over the fallback. */
  tableColumns: string[]
  /** ⚠️ Which catalogue part a position is a quantity OF. Set on the Inventory form and nowhere else. */
  stockPartField: string | null
  stockQuantityField: string | null
  /** Where the thing is. Points at a field, which may itself be sourced from the Locations catalogue. */
  stockLocationField: string | null
  /** ⚠️ On a POSITION: what this batch cost. Not the same question as {@link priceField}. */
  stockPriceField: string | null
  /** ⚠️ The least worth keeping IN THIS PLACE — compared with this row's quantity, not with a total. */
  stockThresholdField: string | null
  /** ⚠️ On a PART: what one costs to buy, for a part nobody may hold yet. Nothing shipped binds one. */
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
  const filterableFields = nameList(map[FORM_CONFIG_KEYS.FILTERABLE_FIELDS])

  return {
    primaryField,
    secondaryField,
    imageField,
    colourField: text(FORM_CONFIG_KEYS.COLOUR_FIELD),
    priorityFields,
    filterableFields,
    tableColumns: nameList(map[FORM_CONFIG_KEYS.TABLE_COLUMNS]),
    stockPartField: text(FORM_CONFIG_KEYS.STOCK_PART_FIELD),
    stockQuantityField: text(FORM_CONFIG_KEYS.STOCK_QUANTITY_FIELD),
    stockLocationField: text(FORM_CONFIG_KEYS.STOCK_LOCATION_FIELD),
    stockPriceField: text(FORM_CONFIG_KEYS.STOCK_PRICE_FIELD),
    stockThresholdField: text(FORM_CONFIG_KEYS.STOCK_THRESHOLD_FIELD),
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
