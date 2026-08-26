import type { PricingOffer } from "@/api/pricing"
import { FORM_CONFIG_KEYS, PRICING_CONFIG_KEYS } from "@/lib/formConfigs"
import type { FieldDetail } from "@/types"
import type { ValueSynonym } from "@/api/valueSynonyms"

/**
 * What a distributor's answer offers, and which configuration key says where it goes.
 *
 * ⚠️ **The form decides, not this table.** A component type that names none of these keys cannot be
 * filled from a lookup at all — and that is a sentence the screen has to say, because the alternative is
 * guessing which of its twenty fields means "manufacturer" and being wrong in a way nobody notices.
 */
export const OFFER_MAPPINGS: Array<{
  configKey: string
  label: string
  read: (offer: PricingOffer) => string | null
}> = [
  { configKey: PRICING_CONFIG_KEYS.PART_NUMBER_FIELD, label: "Part number", read: (offer) => offer.partNumber },
  { configKey: PRICING_CONFIG_KEYS.MANUFACTURER_FIELD, label: "Manufacturer", read: (offer) => offer.manufacturer },
  { configKey: PRICING_CONFIG_KEYS.NAME_FIELD, label: "Name", read: (offer) => offer.partNumber },
  { configKey: PRICING_CONFIG_KEYS.DESCRIPTION_FIELD, label: "Description", read: (offer) => offer.description },
  {
    configKey: PRICING_CONFIG_KEYS.PRICE_FIELD,
    label: "Price",
    // ⚠️ The first break, which is the *smallest* quantity — the one somebody buying a handful pays.
    read: (offer) => offer.priceBreaks?.[0]?.unitPrice?.toString() ?? null,
  },
  { configKey: PRICING_CONFIG_KEYS.BUY_URL_FIELD, label: "Where to buy", read: (offer) => offer.buyUrl },
  { configKey: PRICING_CONFIG_KEYS.DATASHEET_URL_FIELD, label: "Datasheet", read: (offer) => offer.dataSheetUrl },
  { configKey: PRICING_CONFIG_KEYS.IMAGE_URL_FIELD, label: "Image", read: (offer) => offer.imageUrl },
]

/**
 * What a distributor's answer offers as a FILE, and which field would hold it.
 *
 * ⚠️ **A different thing from the two URL mappings above, not a duplicate of them.** A datasheet URL is
 * a line somebody follows to a distributor who may retire it; a datasheet *file* is a copy this
 * installation keeps, and a workspace that configured a file field asked for the copy. Both may be set
 * on one form, and then both are offered — the URL to follow and the PDF to hold.
 *
 * ⚠️ **The picture's key is `display.image_field`, which is the same field the tables and the record
 * draw their thumbnail from.** There is no separate `pricing.image_file_field` and there should not be:
 * a second place to say where the picture goes is a second place for it to be said differently.
 */
export const ATTACHMENT_MAPPINGS: Array<{
  configKey: string
  label: string
  read: (offer: PricingOffer) => string | null
}> = [
  {
    configKey: PRICING_CONFIG_KEYS.DATASHEET_FILE_FIELD,
    label: "Datasheet file",
    read: (offer) => offer.dataSheetUrl,
  },
  { configKey: FORM_CONFIG_KEYS.IMAGE_FIELD, label: "Picture", read: (offer) => offer.imageUrl },
]

const ATTACHABLE_TYPES = new Set(["FILE", "IMAGE"])

/**
 * Whether a field can hold a downloaded file at all.
 *
 * ⚠️ **Asked of the FIELD, never assumed from the configuration key.** `display.image_field` is
 * frequently a plain URL field — the address of a picture on somebody else's server — and writing a
 * `token:filename` reference into one would render the reference as text where the picture used to be.
 */
export function isAttachableField(field: FieldDetail | undefined): boolean {
  return !!field && ATTACHABLE_TYPES.has(field.elementType)
}

const CHOICE_TYPES = new Set(["SELECT", "RADIO"])

export type CoercionStatus =
  /** Not a field with choices — the value goes in as it came. */
  | "text"
  /** The value *is* one of the field's option values. */
  | "direct"
  /** Matched through a label or a synonym, so the stored value differs from what the provider sent. */
  | "coerced"
  /** A field with choices and nothing that matched. ⚠️ The raw value would be a new, unchosen option. */
  | "unmatched"

export interface CoercedValue {
  value: string
  status: CoercionStatus
}

function equalsIgnoringCase(first: string, second: string): boolean {
  return first.localeCompare(second, undefined, { sensitivity: "accent" }) === 0
}

/**
 * Land a looked-up value on an option the field already carries.
 *
 * ⚠️ **Three attempts, in order, and the order is the point.** Option *value* first, then option
 * *label* — so a distributor's "Texas Instruments" finds a matching label with no synonym at all — then
 * any synonym spelling. Only then is it `unmatched`, and an unmatched value is flagged rather than
 * written: putting it in would grow the field a second name for one manufacturer, and every filter and
 * count over that field is split in two from that moment on.
 */
export function coerceForField(
  rawValue: string,
  field: FieldDetail | undefined,
  synonyms: ValueSynonym[],
): CoercedValue {
  if (!field || !CHOICE_TYPES.has(field.elementType) || field.options.length === 0) {
    return { value: rawValue, status: "text" }
  }

  const candidates = [rawValue]

  for (const synonym of synonyms) {
    if (equalsIgnoringCase(rawValue, synonym.aliasValue) || equalsIgnoringCase(rawValue, synonym.canonicalValue)) {
      candidates.push(synonym.canonicalValue, synonym.aliasValue)
    }
  }

  for (const candidate of candidates) {
    const byValue = field.options.find((option) => equalsIgnoringCase(option.optionValue, candidate))

    if (byValue) {
      const isDirect = candidate === rawValue && equalsIgnoringCase(byValue.optionValue, rawValue)

      return { value: byValue.optionValue, status: isDirect ? "direct" : "coerced" }
    }

    const byLabel = field.options.find((option) => equalsIgnoringCase(option.optionLabel, candidate))

    if (byLabel) {
      return { value: byLabel.optionValue, status: "coerced" }
    }
  }

  return { value: rawValue, status: "unmatched" }
}
