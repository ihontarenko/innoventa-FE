import { FORM_CONFIG_KEYS, PRICING_CONFIG_KEYS, readFormConfigs } from "@/lib/formConfigs"
import type { FieldDetail, FormDetail, FormEntry } from "@/types"

/**
 * What a record can carry — asked of the form, not of the screen.
 *
 * ⚠️ **One page serves three purposes and has to know what it cannot show.** `INVENTORY`, `CATALOG` and
 * `CAD` are the same route and the same component; a drawing has no datasheet and no price, and only a
 * shelf row has a quantity. Without this the three read as one form with most of its fields empty.
 *
 * ⚠️ **Three states of a fact, not two: absent, unfilled, filled.** *Absent* is drawn nowhere at all —
 * no panel, no field, no tab. *Unfilled* is always drawn, as an action, because it is the only one of
 * the three somebody can do anything about. Collapsing the first two into one dash is what makes a real
 * record read as a column of nothing.
 *
 * ⚠️ **The purpose decides what is PERMITTED; a field decides whether there is anything to say.** Purpose
 * alone draws a stock panel over a form with no quantity field; fields alone let two forms of one
 * purpose look different with nothing on screen explaining why.
 *
 * ⚠️ **And every field lands in exactly ONE place.** Whatever a panel or a tab takes over is *claimed*,
 * and claimed fields leave the details list and each other's lists. Without that a buy address reads
 * once under Supply and again under Links, and an image address reads as a link in two places and as a
 * picture in none.
 */
const PART_PURPOSES = new Set(["INVENTORY", "CATALOG"])

/**
 * What a field is called when nobody has said.
 *
 * ⚠️ **A named fallback, not a guess — and the difference is that these names are the PRODUCT'S OWN.**
 * Every component type this installation seeds spells its quantity `quantity` and its datasheet
 * `datasheet_url`; the convention exists whether or not this file reads it. Requiring the configuration
 * instead was tried first and is why the shipped `bjt` type — which has `quantity`,
 * `min_stock_threshold`, `datasheet_url`, `datasheet_file`, `approximate_price` and `buy_url`, and
 * declares none of them under `stock.*` or `pricing.*` — drew an empty rail beside a full record.
 *
 * ⚠️ **The fallback only ever fires against a field that EXISTS**, so a workspace that renamed one gets
 * the same nothing it gets today rather than a panel about a field that is not there. Configuration
 * always wins: naming the field is how a workspace overrules this table.
 */
const CONVENTIONAL_FIELDS = {
  quantity: "quantity",
  threshold: "min_stock_threshold",
  location: "storage_location",
  price: "approximate_price",
  vendor: "vendor",
  sku: "vendor_sku",
  leadTime: "lead_time",
  buyUrl: "buy_url",
  datasheetUrl: "datasheet_url",
  datasheetFile: "datasheet_file",
} as const

/**
 * Fields that hold a web address to a *picture* rather than to a page.
 *
 * ⚠️ **Rendered as the picture, never as the address.** A `.jpg` printed as a truncated link is the one
 * value on a record that nobody can read anything from — and the thing it points at is the single most
 * useful thing on the page.
 */
const IMAGE_URL_FIELDS = new Set(["image_url", "photo_url", "picture_url"])

export interface StockCapability {
  quantity: FieldDetail
  threshold: FieldDetail | null
  location: FieldDetail | null
}

export interface SupplyCapability {
  price: FieldDetail | null
  vendor: FieldDetail | null
  sku: FieldDetail | null
  leadTime: FieldDetail | null
  buyUrl: FieldDetail | null
}

export interface DatasheetCapability {
  url: FieldDetail | null
  file: FieldDetail | null
}

export interface EntryCapabilities {
  purposeCode: string | null
  /** ⚠️ A shelf row only. A catalogue part describes a component; the quantity belongs to the shelf. */
  stock: StockCapability | null
  supply: SupplyCapability | null
  datasheet: DatasheetCapability | null
  /**
   * Pictures this record carries **beside** the one naming it.
   *
   * ⚠️ **The identity thumbnail is deliberately not among them.** It is already on the card at the top,
   * and a tab repeating it would be the same duplication this module exists to remove.
   */
  imageFields: FieldDetail[]
  /** Address fields nothing else has taken — Supply owns the buy address, the image tab owns pictures. */
  linkFields: FieldDetail[]
  /** This record *is* a drawing — it is referenced rather than referencing. */
  isDrawing: boolean
  canLookUp: boolean
  /** Every field a panel or a tab has taken over, so the details list stops printing it. */
  claimedFieldNames: string[]
  /**
   * What this purpose does not carry at all, in words.
   *
   * ⚠️ **An explanation, never a gap.** Without one sentence somewhere, "this form has no prices" and
   * "nobody filled the price in" look identical on screen — which is the whole defect this module
   * exists to fix, reappearing at the bottom of the page.
   */
  absent: string[]
}

/**
 * The field for a role: what the form NAMED, else what the product conventionally calls it.
 *
 * ⚠️ Both halves are checked against the form's real fields, so neither can name one that is not there.
 */
function fieldFor(
  form: FormDetail,
  byName: Map<string, FieldDetail>,
  configKey: string | null,
  conventional: string,
): FieldDetail | null {
  const named = configKey ? form.config?.[configKey]?.trim() : null

  return (named ? byName.get(named) : undefined) ?? byName.get(conventional) ?? null
}

export function readEntryCapabilities(form: FormDetail): EntryCapabilities {
  const purposeCode = form.purpose?.code ?? null
  const configs = readFormConfigs(form.config)
  const isPart = !!purposeCode && PART_PURPOSES.has(purposeCode)
  const isDrawing = purposeCode === "CAD"

  const byName = new Map(form.fields.map((field) => [field.name, field]))
  const claimed = new Set<string>()
  const claim = <T extends FieldDetail | null>(field: T): T => {
    if (field) {
      claimed.add(field.name)
    }

    return field
  }

  /* The identity card already draws it, so nothing else may. */
  if (configs.primaryField) {
    claimed.add(configs.primaryField)
  }
  if (configs.secondaryField) {
    claimed.add(configs.secondaryField)
  }
  if (configs.imageField) {
    claimed.add(configs.imageField)
  }

  /* ⚠️ INVENTORY alone, deliberately. A catalogue part that grew a quantity would be a second answer to
     "how many are there", and the two would disagree the first time somebody counted a drawer. */
  const quantity =
    purposeCode === "INVENTORY"
      ? fieldFor(form, byName, FORM_CONFIG_KEYS.STOCK_QUANTITY_FIELD, CONVENTIONAL_FIELDS.quantity)
      : null

  const stock = quantity
    ? {
        quantity: claim(quantity),
        threshold: claim(
          fieldFor(form, byName, FORM_CONFIG_KEYS.STOCK_THRESHOLD_FIELD, CONVENTIONAL_FIELDS.threshold),
        ),
        /* ⚠️ **Configured like the other two, and it was not.** Every role here reads a configuration key
           first and falls back to the convention; the location alone was matched by name and nothing
           else — a hardcode wearing the same clothes as a fallback. A workspace that renamed the field,
           or keeps two, had no way to say which one meant *where it is*. */
        location: claim(
          fieldFor(form, byName, FORM_CONFIG_KEYS.STOCK_LOCATION_FIELD, CONVENTIONAL_FIELDS.location),
        ),
      }
    : null

  const price = isPart ? fieldFor(form, byName, PRICING_CONFIG_KEYS.PRICE_FIELD, CONVENTIONAL_FIELDS.price) : null

  /* ⚠️ The buy address belongs to Supply, beside the price it is the address FOR — and is therefore not
     offered again under Links. Two homes for one address is what made the tab read as a duplicate. */
  const buyUrl = isPart
    ? fieldFor(form, byName, PRICING_CONFIG_KEYS.BUY_URL_FIELD, CONVENTIONAL_FIELDS.buyUrl)
    : null

  const supply =
    price || buyUrl
      ? {
          price: claim(price),
          vendor: claim(byName.get(CONVENTIONAL_FIELDS.vendor) ?? null),
          sku: claim(byName.get(CONVENTIONAL_FIELDS.sku) ?? null),
          leadTime: claim(byName.get(CONVENTIONAL_FIELDS.leadTime) ?? null),
          buyUrl: claim(buyUrl),
        }
      : null

  const url = isPart
    ? fieldFor(form, byName, PRICING_CONFIG_KEYS.DATASHEET_URL_FIELD, CONVENTIONAL_FIELDS.datasheetUrl)
    : null
  const file = isPart
    ? fieldFor(form, byName, PRICING_CONFIG_KEYS.DATASHEET_FILE_FIELD, CONVENTIONAL_FIELDS.datasheetFile)
    : null

  const datasheet = url || file ? { url: claim(url), file: claim(file) } : null

  /* Every picture that is not the one on the card — a real IMAGE field, or an address to a picture. */
  const imageFields = form.fields.filter(
    (field) =>
      !claimed.has(field.name) &&
      field.usageType !== "EMBEDDABLE" &&
      (field.elementType === "IMAGE" || IMAGE_URL_FIELDS.has(field.name)),
  )

  imageFields.forEach((field) => claimed.add(field.name))

  /* ⚠️ By the field's declared TYPE, not by what a value happens to look like. A note that quotes a URL
     is still a note, and filing it under somewhere-to-go would be filing prose as navigation. */
  const linkFields = form.fields.filter(
    (field) =>
      !claimed.has(field.name) && field.usageType !== "EMBEDDABLE" && field.elementType === "URL",
  )

  linkFields.forEach((field) => claimed.add(field.name))

  /* ⚠️ Only what the PURPOSE rules out is named here. A part whose form simply never carried a datasheet
     field is not told it cannot have one — it can, and saying otherwise would send somebody looking for
     a setting that is right there. */
  const absent: string[] = []

  if (isDrawing) {
    absent.push("a quantity", "a price", "a datasheet")
  } else if (purposeCode === "CATALOG") {
    absent.push("a quantity")
  }

  return {
    purposeCode,
    stock,
    supply,
    datasheet,
    imageFields,
    linkFields,
    isDrawing,
    canLookUp: isPart,
    /* ⚠️ The identity fields are claimed too, but `EntryDetailsList` already excludes them by its own
       reading of `display.*` — passing them again is harmless and keeps this list the whole truth. */
    claimedFieldNames: [...claimed],
    absent,
  }
}

/** Whether a field this record carries actually holds anything. */
export function hasValue(entry: FormEntry, field: FieldDetail | null | undefined): boolean {
  return !!field && !!entry.fieldValues[field.name]
}
