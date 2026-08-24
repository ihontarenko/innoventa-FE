import type { ElementType } from "@/types"
import { STATIC_OPTION_SOURCE, optionSourceOf } from "@/lib/fieldOptions"
import { CheckboxControl, ToggleControl } from "./controls/BooleanControls"
import { CheckboxesControl, MultiSelectControl, RadioControl, SelectControl } from "./controls/ChoiceControls"
import { FileUploadControl } from "./controls/FileUploadControl"
import { ComplexCompositeControl, NumberControl, RangeControl, SimpleCompositeControl } from "./controls/NumericControls"
import { SourcedChoiceControl } from "./controls/SourcedChoiceControl"
import { ColorControl, RatingControl, TagsControl } from "./controls/SpecialControls"
import { DateControl, TextControl, TextareaControl } from "./controls/TextControls"
import type { ControlProperties } from "./controls/types"

/**
 * The control for one field — the input itself, with no label and no wrapper around it.
 *
 * ⚠️ **A dispatcher and nothing else.** It used to be a 560-line `switch` with every control inlined
 * in its arm, which is why adding an element type meant editing the file every other element type
 * lives in. The table below is the whole of the decision; the controls are in `controls/`, one module
 * per family.
 *
 * ⚠️ **This is the single renderer behind both `DynamicForm`'s labelled rows and a jMouse-EL live
 * block**, so a field looks and behaves the same wherever it is filled. Anything drawn *around* the
 * control — label, description, error message — belongs to the caller, and a control that grew one
 * would be right in one place and wrong in the other.
 */
const CONTROLS: Partial<Record<ElementType, (properties: ControlProperties) => React.ReactNode>> = {
  TEXT: TextControl,
  EMAIL: TextControl,
  URL: TextControl,
  TEXTAREA: TextareaControl,
  DATE: DateControl,

  NUMBER: NumberControl,
  RANGE: RangeControl,
  SIMPLE_COMPOSITE: SimpleCompositeControl,
  COMPLEX_COMPOSITE: ComplexCompositeControl,

  SELECT: SelectControl,
  MULTISELECT: MultiSelectControl,
  RADIO: RadioControl,
  CHECKBOXES: CheckboxesControl,

  CHECKBOX: CheckboxControl,
  TOGGLE: ToggleControl,

  TAGS: TagsControl,
  COLOR: ColorControl,
  RATING: RatingControl,

  // ⚠️ One control for both. What differs is what it accepts and whether the field asks for a crop —
  // two components would be two places to fix the token-shaped value, the size limit and the detach.
  FILE: (properties) => FileUploadControl(properties),
  IMAGE: (properties) => FileUploadControl({ ...properties, acceptImages: true }),
}

/** The widgets that render choices, and therefore the ones a provider can draw options for. */
const HAS_SOURCED_CHOICES = new Set<ElementType>(["SELECT", "MULTISELECT", "RADIO", "CHECKBOXES"])

export function FieldControl(properties: ControlProperties) {
  const { field } = properties

  // A field that renders nothing — a heading or a spacer on the form. It is a real element type, not a
  // missing one, so it returns null rather than falling through to the text box below.
  if (field.elementType === "NONE") {
    return null
  }

  // ⚠️ Choices drawn by a provider are a different control, not a different element type. The four
  // widgets above gained dynamic options without any of them growing a branch — which is exactly why
  // this check lives here, once, rather than inside each of them.
  if (optionSourceOf(field) !== STATIC_OPTION_SOURCE && HAS_SOURCED_CHOICES.has(field.elementType)) {
    return <SourcedChoiceControl {...properties} />
  }

  const Control = CONTROLS[field.elementType]

  // ⚠️ An unknown element type falls back to a text box rather than to nothing. The backend owns this
  // vocabulary, and one it adds first must cost a plain input — never a field the reader cannot fill
  // and cannot see.
  return Control ? <Control {...properties} /> : <TextControl {...properties} />
}

export { ChildFieldControl } from "./controls/ChildFieldControl"
export type { ControlProperties } from "./controls/types"
