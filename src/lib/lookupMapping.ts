import type { LookupOffer } from "@/api/lookup"
import { FORM_CONFIG_KEYS, PRICING_CONFIG_KEYS } from "@/lib/formConfigs"
import type { FieldDetail } from "@/types"
import type { ValueSynonym } from "@/api/valueSynonyms"

/**
 * What a distributor's answer offers, and which configuration key says where it goes.
 *
 * ⚠️ **The form decides, not this table.** A component type that names none of these keys cannot be
 * filled from a lookup at all — and that is a sentence the screen has to say, because the alternative is
 * guessing which of its twenty fields means "manufacturer" and being wrong in a way nobody notices.
 *
 * ⚠️ **`read` is handed the DESTINATION FIELD, and the price mapping is why.** A price is the one thing
 * here that is a quantity rather than a string — a number *and* a currency — so what may be written
 * depends on what the field can hold. Everything else ignores the argument.
 */
export const OFFER_MAPPINGS: Array<{
  configKey: string
  label: string
  read: (offer: LookupOffer, field?: FieldDetail) => string | null
}> = [
  { configKey: PRICING_CONFIG_KEYS.PART_NUMBER_FIELD, label: "Part number", read: (offer) => offer.partNumber },
  { configKey: PRICING_CONFIG_KEYS.MANUFACTURER_FIELD, label: "Manufacturer", read: (offer) => offer.manufacturer },
  { configKey: PRICING_CONFIG_KEYS.NAME_FIELD, label: "Name", read: (offer) => offer.partNumber },
  { configKey: PRICING_CONFIG_KEYS.DESCRIPTION_FIELD, label: "Description", read: (offer) => offer.description },
  {
    configKey: PRICING_CONFIG_KEYS.PRICE_FIELD,
    label: "Price",
    // ⚠️ The first break, which is the *smallest* quantity — the one somebody buying a handful pays.
    read: (offer, field) => {
      const unitPrice = offer.priceBreaks?.[0]?.unitPrice

      if (unitPrice === undefined || unitPrice === null) {
        return null
      }

      return priceWithCurrency(unitPrice.toString(), offer.currency, field)
    },
  },
  { configKey: PRICING_CONFIG_KEYS.BUY_URL_FIELD, label: "Where to buy", read: (offer) => offer.buyUrl },
  { configKey: PRICING_CONFIG_KEYS.DATASHEET_URL_FIELD, label: "Datasheet", read: (offer) => offer.dataSheetUrl },
  { configKey: PRICING_CONFIG_KEYS.IMAGE_URL_FIELD, label: "Image", read: (offer) => offer.imageUrl },
]

/** The only element type that can hold a number and a unit together, as `100|nF` or `5|USD`. */
const COMPOSITE_TYPE = "SIMPLE_COMPOSITE"

/**
 * A looked-up price, carrying its currency where the field can hold one.
 *
 * ⚠️ **The currency used to be dropped here, and it is what made the stock total meaningless.** Both
 * distributors return one, and it went nowhere: the mapping wrote `unitPrice.toString()` and nothing
 * else. `FormEntryService` only ever stores a `unit` for a `SIMPLE_COMPOSITE` field, and the workspace's
 * value is grouped by exactly that unit — so every price ever looked up landed in the nameless bucket,
 * and no amount of exchange-rate machinery upstream could rescue a number whose currency was known,
 * handed over, and thrown away at the last step.
 *
 * ⚠️ **A missing currency is not the base currency.** Where the distributor sent none, the bare number
 * goes in exactly as before — an unlabelled price is reported as unconverted, which is recoverable,
 * whereas a guessed one is a wrong total that looks right.
 */
function priceWithCurrency(amount: string, currency: string | null | undefined, field?: FieldDetail): string {
  if (!currency || field?.elementType !== COMPOSITE_TYPE) {
    return amount
  }

  return `${amount}|${currency}`
}

/**
 * Whether this offer's currency is about to be lost on its way into the price field.
 *
 * ⚠️ **True is not a refusal — the price is still written, without its currency.** The catalogue lets a
 * component type bind `catalogue.price_field` to a plain `NUMBER`, and a number field has nowhere to keep
 * a unit. Nobody downstream can recover what was dropped, and the one person who could prevent it is
 * looking at this dialog, so it is said here rather than logged. The fix is theirs: make the price field
 * a composite one on the type's Catalogue pane.
 */
export function isCurrencyLost(offer: LookupOffer, field: FieldDetail | undefined): boolean {
  const hasPrice = offer.priceBreaks?.[0]?.unitPrice !== undefined && offer.priceBreaks?.[0]?.unitPrice !== null

  return hasPrice && Boolean(offer.currency) && Boolean(field) && field?.elementType !== COMPOSITE_TYPE
}

/**
 * What a distributor's answer offers as a FILE, and which field would hold it.
 *
 * ⚠️ **A different thing from the two URL mappings above, not a duplicate of them.** A datasheet URL is
 * a line somebody follows to a distributor who may retire it; a datasheet *file* is a copy this
 * installation keeps, and a workspace that configured a file field asked for the copy. Both may be set
 * on one form, and then both are offered — the URL to follow and the PDF to hold.
 *
 * ⚠️ **The picture's key is `display.image_field`, which is the same field the tables and the record
 * draw their thumbnail from.** There is no separate `catalogue.image_file_field` and there should not be:
 * a second place to say where the picture goes is a second place for it to be said differently.
 */
export const ATTACHMENT_MAPPINGS: Array<{
  configKey: string
  label: string
  read: (offer: LookupOffer) => string | null
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

/**
 * Which synonyms apply to the field a mapping is writing into.
 *
 * ⚠️ **One function because two dialogs had two different answers, and both were writing to the same
 * rows.** `AddFromLookupDialog` passed manufacturer synonyms only to the manufacturer field;
 * `EntryLookupDialog` passed them to *every* field. `coerceForField` matches a synonym in either
 * direction, so in the second dialog a manufacturer mapping could land on a `Category` or `Package`
 * dropdown that happened to share a spelling — quietly rewriting a value to something a manufacturer
 * table decided. The same offer, applied through two screens, produced two different stored values.
 *
 * ⚠️ **The answer chosen is the narrow one: a synonym belongs to its group, and the only group that
 * exists is manufacturers.** `ValueSynonym` carries a `synonymGroup` and nothing binds a group to a
 * configuration key yet, so widening it would mean inventing that binding — and the wider reading is
 * exactly the one that was silently rewriting fields. When a second group is wanted, this function is
 * the one place that has to learn about it.
 */
export function synonymsForMapping(configKey: string, manufacturerSynonyms: ValueSynonym[]): ValueSynonym[] {
  return configKey === PRICING_CONFIG_KEYS.MANUFACTURER_FIELD ? manufacturerSynonyms : []
}

/**
 * ⚠️ **The four field types where a value has to BE one of the options.**
 *
 * `MULTISELECT` and `CHECKBOXES` were missing, and the omission was not harmless: a looked-up value was
 * written into them verbatim, with no matching and no `unmatched` flag — which is precisely the failure
 * this coercion exists to prevent, reappearing on the field types nobody thought about. They store
 * comma-separated option values and a lookup only ever contributes one, so single-value matching is
 * exactly right for them.
 */
const CHOICE_TYPES = new Set(["SELECT", "RADIO", "MULTISELECT", "CHECKBOXES"])

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
