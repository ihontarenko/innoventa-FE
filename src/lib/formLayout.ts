import type { ElementType, FieldDetail, FormDetail } from "@/types"

/**
 * How a form arranges itself, worked out from what the schema already carries.
 *
 * ⚠️ **A pure module beside `DynamicForm`, for the reason its own header gives**: the component holds the
 * answers and draws them, and everything it *decides* lives next to it in `lib`. Layout is a decision.
 *
 * ⚠️ **Nothing here needed a backend change.** `field_configs` has always been a per-field key/value map
 * and `FormDetail.fields` has always been `FieldDetail[]`, which carries `configs`. The schema could
 * already say how a field should be laid out; nothing read it.
 */

/** How much of a row one field takes. */
export type FieldWidth = "full" | "half" | "third"

const WIDTH_KEY = "layout.width"
const SECTION_KEY = "layout.section"

/** Tailwind spans over a twelve-column grid. Below `sm` every field is a full row regardless. */
export const WIDTH_CLASS: Record<FieldWidth, string> = {
  full: "col-span-12",
  half: "col-span-12 sm:col-span-6",
  third: "col-span-12 sm:col-span-4",
}

/**
 * Element types that are unreadable at half a row.
 *
 * ⚠️ **An inferred default rather than a required setting.** A form nobody has configured still improves,
 * which is what makes this worth doing at all — a layout that only works once somebody fills in eleven
 * config rows is a layout nobody sees.
 */
const ALWAYS_FULL: ReadonlySet<ElementType> = new Set<ElementType>([
  "TEXTAREA",
  "IMAGE",
  "FILE",
  "TAGS",
  "CHECKBOXES",
  "MULTISELECT",
  "RANGE",
  "COMPLEX_COMPOSITE",
])

/**
 * What this field asked for, or what its type deserves.
 *
 * ⚠️ **Width is the FIELD's, not the placement's**, and that is a trade rather than an oversight. A serial
 * number is a short string on every form it ever appears on, so the field is the honest owner. Section
 * membership is more arguable — the same field could group differently on two forms — but
 * `form_field_mapping` carries only a sequence, and widening it for that case is not worth a migration
 * until somebody actually hits it.
 */
export function widthOf(field: FieldDetail): FieldWidth {
  const asked = field.configs?.[WIDTH_KEY]

  if (asked === "full" || asked === "half" || asked === "third") {
    return asked
  }

  return ALWAYS_FULL.has(field.elementType) ? "full" : "half"
}

/** One heading and the fields under it. A section with no title is the leading, unnamed group. */
export interface FormSection {
  title: string | null
  fields: FieldDetail[]
}

/**
 * The form's fields, grouped into the sections they name.
 *
 * ⚠️ **Order is the schema's, and sections appear in the order they are first mentioned.** Sorting
 * sections alphabetically would put *Condition* above *Identity* and make every form read backwards; the
 * person who ordered the fields already said what comes first.
 *
 * ⚠️ **A field naming no section is not an error.** It joins the leading group, which is what an
 * unconfigured form is entirely made of — and that group draws no heading, so nothing appears until
 * somebody has something to say.
 */
export function sectionsOf(form: FormDetail): FormSection[] {
  const sections: FormSection[] = []
  const byTitle = new Map<string, FormSection>()

  for (const field of form.fields) {
    if (!field || field.status === "DELETED") {
      continue
    }

    const title = field.configs?.[SECTION_KEY]?.trim() || null
    const key = title ?? ""

    let section = byTitle.get(key)

    if (!section) {
      section = { title, fields: [] }
      byTitle.set(key, section)
      sections.push(section)
    }

    section.fields.push(field)
  }

  return sections
}

/**
 * Whether drawing headings would say anything.
 *
 * A form whose fields all sit in the one unnamed group is every form nobody has configured, and a single
 * blank heading above it is chrome with no content.
 */
export function hasNamedSections(sections: FormSection[]): boolean {
  return sections.some((section) => section.title !== null)
}
