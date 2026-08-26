import type { ElementType } from "@/types"

/**
 * Every configuration key a form carries, and what kind of thing it holds.
 *
 * ⚠️ **A table, not thirty hand-written panels.** The old `FormConfigPanel` is 557 lines of the same
 * label / picker / save-indicator shape repeated per key — which is why half the keys never got a
 * control at all and lived only in the raw editor. Declaring them means a new key is one row here, and
 * it arrives with a picker for free.
 *
 * ⚠️ **`field` keys store a field's `name`, never its id.** That is what the backend reads, and what
 * makes a configuration survive a field being detached and re-attached.
 */
export type ConfigControl =
  | { kind: "field"; accepts?: ElementType[] }
  | { kind: "fields" }
  | { kind: "text"; placeholder?: string; long?: boolean }
  | { kind: "boolean" }
  | { kind: "choice"; options: Array<{ value: string; label: string }> }
  | { kind: "colour" }

export interface ConfigEntry {
  key: string
  label: string
  hint?: string
  control: ConfigControl
}

/**
 * Which level a group of keys belongs to.
 *
 * ⚠️ **This is the levels rule, made into data.** `form` keys are true of *any* form whatever a
 * workspace counts — what an entry is called, which fields lead on its card, what the submit button
 * says. `subject-area` keys are only meaningful inside one: `stock.quantity_field` presumes a thing
 * you have a number of, `pricing.part_number_field` presumes a distributor.
 *
 * ⚠️ **The split decides where a group may be SHOWN.** The form library's Manage sheet carries the
 * `form` ones, because they are useful everywhere; it must never carry the others, or the low level
 * and the subject area cross — which is exactly what `LevelDoor` (`INVT-0076`) exists to prevent.
 * The builder shows everything, because a builder is already inside one workspace.
 */
export type ConfigScope = "form" | "subject-area"

export interface ConfigGroup {
  title: string
  hint?: string
  /** ⚠️ Defaults to `form` only where it is stated — every group says which it is, deliberately. */
  scope: ConfigScope
  entries: ConfigEntry[]
}

/** The element types that can stand for a picture. */
const IMAGE_LIKE: ElementType[] = ["IMAGE", "FILE", "URL", "TEXT"]

export const FORM_CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: "Display",
    scope: "form",
    hint: "How an entry of this form is summarised wherever it is listed.",
    entries: [
      {
        key: "display.primary_field",
        label: "Title field",
        hint: "Falls back to the first field.",
        control: { kind: "field" },
      },
      { key: "display.secondary_field", label: "Subtitle field", hint: "Hidden when unset.", control: { kind: "field" } },
      { key: "display.image_field", label: "Thumbnail field", control: { kind: "field", accepts: IMAGE_LIKE } },
      { key: "display.color_field", label: "Colour field", control: { kind: "field", accepts: ["COLOR", "TEXT"] } },
      {
        key: "display.priority_fields",
        label: "Highlighted fields",
        hint: "Shown on the card before the rest.",
        control: { kind: "fields" },
      },
      { key: "display.table_columns", label: "Table columns", control: { kind: "fields" } },
      { key: "display.group_by_field", label: "Group by", control: { kind: "field" } },
      { key: "display.sort_default_field", label: "Sort by", control: { kind: "field" } },
      {
        key: "display.sort_default_direction",
        label: "Sort direction",
        control: {
          kind: "choice",
          options: [
            { value: "ASC", label: "Ascending" },
            { value: "DESC", label: "Descending" },
          ],
        },
      },
      { key: "form.accent_color", label: "Accent colour", control: { kind: "colour" } },
    ],
  },
  {
    title: "Submitting",
    scope: "form",
    entries: [
      { key: "submit.button_text", label: "Button text", control: { kind: "text", placeholder: "Submit" } },
      { key: "submit.success_message", label: "Message after sending", control: { kind: "text", long: true } },
      {
        key: "submit.success_redirect_url",
        label: "Redirect afterwards",
        control: { kind: "text", placeholder: "https://…" },
      },
      { key: "submit.allow_resubmit", label: "Allow sending more than once", control: { kind: "boolean" } },
      {
        key: "submit.mode",
        label: "Where submissions go",
        control: {
          kind: "choice",
          options: [
            { value: "LOCAL", label: "Store in Innoventa (default)" },
            { value: "BOTH", label: "Store and forward" },
            { value: "REMOTE", label: "Forward only — do not store" },
          ],
        },
      },
      {
        key: "submit.target_url",
        label: "Forward to",
        hint: "⚠️ Required by both forwarding modes — without it they store nothing and send nowhere.",
        control: { kind: "text", placeholder: "https://api.example.com/submissions" },
      },
      { key: "submit.notify_email", label: "Notify by email", control: { kind: "text", placeholder: "team@example.com" } },
    ],
  },
  {
    title: "Validation",
    scope: "form",
    entries: [
      {
        key: "validation.unique_field",
        label: "Must be unique",
        hint: "No two entries of this form may share this field's value.",
        control: { kind: "field" },
      },
    ],
  },
  {
    title: "Stock",
    scope: "subject-area",
    hint: "Only meaningful where the workspace counts things.",
    entries: [
      { key: "stock.quantity_field", label: "Quantity", control: { kind: "field", accepts: ["NUMBER", "SIMPLE_COMPOSITE"] } },
      { key: "stock.threshold_field", label: "Low-stock threshold", control: { kind: "field", accepts: ["NUMBER"] } },
      { key: "stock.location_field", label: "Where it is kept", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
    ],
  },
  {
    title: "Pricing",
    scope: "subject-area",
    hint: "Which field means what, when this form is read as a catalogue entry.",
    entries: [
      { key: "pricing.name_field", label: "Name", control: { kind: "field" } },
      { key: "pricing.price_field", label: "Price", control: { kind: "field", accepts: ["NUMBER", "SIMPLE_COMPOSITE"] } },
      { key: "pricing.part_number_field", label: "Part number", control: { kind: "field" } },
      { key: "pricing.manufacturer_field", label: "Manufacturer", control: { kind: "field" } },
      { key: "pricing.description_field", label: "Description", control: { kind: "field" } },
      { key: "pricing.datasheet_url_field", label: "Datasheet link", control: { kind: "field", accepts: ["URL", "TEXT"] } },
      { key: "pricing.datasheet_file_field", label: "Datasheet file", control: { kind: "field", accepts: ["FILE"] } },
      { key: "pricing.buy_url_field", label: "Where to buy", control: { kind: "field", accepts: ["URL", "TEXT"] } },
      { key: "pricing.image_url_field", label: "Image link", control: { kind: "field", accepts: IMAGE_LIKE } },
    ],
  },
]

/** Every key the table above knows — what the raw editor is asked to point out as *not* covered. */
export const CATALOGUED_CONFIG_KEYS = new Set(
  FORM_CONFIG_GROUPS.flatMap((group) => group.entries.map((entry) => entry.key)),
)
