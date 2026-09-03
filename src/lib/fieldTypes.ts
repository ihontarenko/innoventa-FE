import type { ElementType, UsageType } from "@/types"

/**
 * What each element type is called, and what it is for.
 *
 * ⚠️ **The label is not the enum.** `SIMPLE_COMPOSITE` is "Quantity" to whoever builds a form, and
 * `NONE` is "Display only" — nobody picking a field type should have to know the vocabulary the
 * backend stores. The hint is what makes the difference between the two composites decidable without
 * trying both.
 */
export interface FieldTypeDescriptor {
  id: ElementType
  label: string
  glyph: string
  group: "Basic" | "Choice" | "Special" | "Structure"
  hint: string
}

export const FIELD_TYPES: FieldTypeDescriptor[] = [
  { id: "TEXT", label: "Short text", glyph: "T", group: "Basic", hint: "Single-line text input" },
  { id: "TEXTAREA", label: "Long text", glyph: "¶", group: "Basic", hint: "Multi-line textarea" },
  { id: "NUMBER", label: "Number", glyph: "#", group: "Basic", hint: "Numeric with optional unit suffix" },
  {
    id: "SIMPLE_COMPOSITE",
    label: "Quantity",
    glyph: "∿",
    group: "Basic",
    hint: "Number with a selectable unit (100 nF, 4.7 kΩ)",
  },
  {
    id: "COMPLEX_COMPOSITE",
    label: "Multi-segment",
    glyph: "⊞",
    group: "Basic",
    hint: "Several typed sub-fields stored as one value (SMD|LQFP|64)",
  },
  { id: "RANGE", label: "Range", glyph: "⇿", group: "Basic", hint: "Min / max numeric pair" },

  { id: "SELECT", label: "Dropdown", glyph: "▾", group: "Choice", hint: "One value from a dropdown" },
  { id: "MULTISELECT", label: "Multi-select", glyph: "☰", group: "Choice", hint: "One or more from a list" },
  { id: "RADIO", label: "Radio group", glyph: "◉", group: "Choice", hint: "One value, all options visible" },
  { id: "CHECKBOX", label: "Checkbox", glyph: "☐", group: "Choice", hint: "A single yes / no" },
  { id: "CHECKBOXES", label: "Checkboxes", glyph: "☑", group: "Choice", hint: "Independent yes/no from a list" },
  { id: "TOGGLE", label: "Toggle", glyph: "↯", group: "Choice", hint: "On / off switch" },

  { id: "EMAIL", label: "Email", glyph: "@", group: "Special", hint: "Validated email address" },
  { id: "URL", label: "URL", glyph: "⤴", group: "Special", hint: "Validated web link" },
  { id: "DATE", label: "Date", glyph: "◷", group: "Special", hint: "Date picker" },
  { id: "TAGS", label: "Tags", glyph: "⌗", group: "Special", hint: "Free-form tags" },
  { id: "FILE", label: "File", glyph: "⤓", group: "Special", hint: "File attachment" },
  { id: "IMAGE", label: "Image", glyph: "🖼", group: "Special", hint: "Image attachment with a preview" },
  { id: "COLOR", label: "Colour", glyph: "◐", group: "Special", hint: "Swatch picker" },
  { id: "RATING", label: "Rating", glyph: "★", group: "Special", hint: "Star rating" },

  { id: "NONE", label: "Display only", glyph: "—", group: "Structure", hint: "Renders nothing — a heading or spacer" },
]

export function fieldTypeOf(elementType: ElementType): FieldTypeDescriptor {
  return FIELD_TYPES.find((descriptor) => descriptor.id === elementType) ?? FIELD_TYPES[0]
}

export function fieldTypesByGroup(): Array<[string, FieldTypeDescriptor[]]> {
  const groups = new Map<string, FieldTypeDescriptor[]>()

  for (const descriptor of FIELD_TYPES) {
    groups.set(descriptor.group, [...(groups.get(descriptor.group) ?? []), descriptor])
  }

  return [...groups.entries()]
}

/**
 * The element types that have choices — and therefore the ones with a *Choices* section.
 *
 * ⚠️ `COLOR` is in here even though it is not a list to pick from: its swatches are stored as option
 * rows, which is why the section shows for it and says "swatches" instead.
 */
export const HAS_OPTIONS = new Set<ElementType>([
  "SELECT",
  "MULTISELECT",
  "RADIO",
  "CHECKBOXES",
  "SIMPLE_COMPOSITE",
  "COLOR",
])

/** The types where a unit suffix means something. */
export const HAS_UNIT = new Set<ElementType>(["NUMBER", "RANGE", "SIMPLE_COMPOSITE"])

/** The types where a placeholder is drawn inside the control. */
export const HAS_PLACEHOLDER = new Set<ElementType>(["TEXT", "TEXTAREA", "EMAIL", "URL", "NUMBER", "SELECT"])

/**
 * The types whose value may turn out to be a picture, and so may be framed on its way in.
 *
 * ⚠️ **`FILE` is in here and that is not a slip.** One control serves both, and whether a crop is
 * offered is decided per *upload* rather than per field — a `FILE` that receives a photograph gets the
 * same offer, and the same one receiving a PDF gets none. Leaving `FILE` out would hide the settings
 * from exactly the fields people attach screenshots to.
 */
export const HAS_PICTURE = new Set<ElementType>(["IMAGE", "FILE"])

/**
 * Where a field may stand — the **one** list, carrying its own glyph.
 *
 * ⚠️ **There were three of these and they had already disagreed.** This one, the Fields screen's, and
 * `CreateFieldDialog`'s — and the third had only STANDALONE, VIRTUAL and EMBEDDABLE, so a phantom field
 * could be seen, filtered and counted but never created. Nothing failed; the option simply was not
 * offered, which is the kind of gap that survives for months because it looks like a decision.
 */
export const USAGE_TYPES: Array<{ value: UsageType; glyph: string; label: string; hint: string }> = [
  { value: "STANDALONE", glyph: "▣", label: "Standalone", hint: "Lives directly on a form" },
  { value: "VIRTUAL", glyph: "⊞", label: "Composite", hint: "A group that holds child fields" },
  { value: "EMBEDDABLE", glyph: "⊡", label: "Embeddable", hint: "A child of a composite group" },
  {
    value: "PHANTOM",
    glyph: "◌",
    label: "Phantom",
    hint: "Answers a condition without being asked — never stored on an entry",
  },
]
