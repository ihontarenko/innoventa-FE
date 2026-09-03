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
  | { kind: "fields"; accepts?: ElementType[] }
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
 * you have a number of, `catalogue.part_number_field` presumes a distributor.
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
      {
        key: "display.filterable_fields",
        /*
         * ⚠️ **A choice belongs here; a measurement does not.** Nominating `resistance` turns every
         * distinct value into its own one-row list, which is a filter that answers only the question
         * somebody already knew. The seed nominates the SELECT and RADIO fields for that reason, and
         * this control accepts the same kinds so the screen agrees with what was seeded.
         */
        label: "Filter from a cell",
        hint: "These values become links that narrow the list to themselves.",
        control: { kind: "fields", accepts: ["SELECT", "RADIO", "CHECKBOX", "MULTISELECT"] },
      },
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
    title: "Position",
    scope: "subject-area",
    hint: "A quantity of one catalogue part, in one place. Only meaningful on a form that counts things.",
    entries: [
      {
        key: "stock.part_field",
        label: "Part",
        hint: "⚠️ Which catalogue part this is a quantity of. Without it a position counts nothing in particular.",
        control: { kind: "field", accepts: ["SELECT", "TEXT"] },
      },
      {
        key: "stock.quantity_field",
        label: "Quantity",
        hint: "⚠️ Binding this shuts the ordinary door: the number then moves by a recorded movement and refuses a direct edit.",
        control: { kind: "field", accepts: ["NUMBER", "SIMPLE_COMPOSITE"] },
      },
      {
        key: "stock.threshold_field",
        label: "Least worth keeping here",
        hint: "⚠️ Compared with THIS row's quantity. A drawer holding three reads low even when the next drawer holds two hundred.",
        control: { kind: "field", accepts: ["NUMBER"] },
      },
      { key: "stock.location_field", label: "Where it is kept", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      { key: "stock.unit_field", label: "Unit", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      {
        key: "stock.price_field",
        label: "What this batch cost",
        hint: "Not the same as the catalogue price, which is what one costs to buy.",
        control: { kind: "field", accepts: ["NUMBER", "SIMPLE_COMPOSITE"] },
      },
      { key: "stock.supplier_field", label: "Bought from", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      { key: "stock.supplier_sku_field", label: "Their code for it", control: { kind: "field" } },
      { key: "stock.received_at_field", label: "Received", control: { kind: "field", accepts: ["DATE", "TEXT"] } },
      { key: "stock.note_field", label: "Note", control: { kind: "field", accepts: ["TEXTAREA", "TEXT"] } },
    ],
  },
  {
    title: "Catalogue",
    scope: "subject-area",
    /* ⚠️ A part may be one nobody has ever held. A record here is information — a datasheet, a package,
       the projects that want it — and it is worth keeping for a part that has not been ordered yet. So
       nothing here counts anything, and there is deliberately no minimum to keep: how many there are is
       the position's answer, and "none" is a perfectly good one. */
    hint: "Which field means what, when this form is read as a part — an identity, not a heap in a drawer.",
    entries: [
      { key: "catalogue.name_field", label: "Name", control: { kind: "field" } },
      { key: "catalogue.part_number_field", label: "Part number", control: { kind: "field" } },
      { key: "catalogue.manufacturer_field", label: "Manufacturer", control: { kind: "field" } },
      { key: "catalogue.package_field", label: "Package", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      { key: "catalogue.lifecycle_field", label: "Lifecycle status", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      {
        key: "catalogue.price_field",
        label: "What one costs to buy",
        hint: "An indication, for a part nobody may hold yet. What a batch actually cost is on the position.",
        control: { kind: "field", accepts: ["NUMBER", "SIMPLE_COMPOSITE"] },
      },
      { key: "catalogue.description_field", label: "Description", control: { kind: "field" } },
      { key: "catalogue.datasheet_url_field", label: "Datasheet link", control: { kind: "field", accepts: ["URL", "TEXT"] } },
      { key: "catalogue.datasheet_file_field", label: "Datasheet file", control: { kind: "field", accepts: ["FILE"] } },
      { key: "catalogue.buy_url_field", label: "Where to buy", control: { kind: "field", accepts: ["URL", "TEXT"] } },
      { key: "catalogue.image_url_field", label: "Image link", control: { kind: "field", accepts: IMAGE_LIKE } },
      { key: "catalogue.vendor_field", label: "Vendor", control: { kind: "field", accepts: ["SELECT", "TEXT"] } },
      { key: "catalogue.vendor_sku_field", label: "Vendor SKU", control: { kind: "field" } },
      { key: "catalogue.rohs_field", label: "RoHS", control: { kind: "field" } },
      { key: "catalogue.lead_time_field", label: "Lead time", control: { kind: "field" } },
    ],
  },
]

/** Every key the table above knows — what the raw editor is asked to point out as *not* covered. */
export const CATALOGUED_CONFIG_KEYS = new Set(
  FORM_CONFIG_GROUPS.flatMap((group) => group.entries.map((entry) => entry.key)),
)
