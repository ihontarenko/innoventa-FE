import { fieldTypeOf } from "@/lib/fieldTypes"
import { EditorSection } from "../EditorSection"
import { TypeChooser } from "../TypeChooser"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * What the field is, and where it may stand.
 *
 * ⚠️ **This is what *Basics* was, minus its identity half.** The label, the icon, the derived name and
 * the required switch moved up into the editor's identity strip, where they are visible whichever card
 * somebody is working in — they are what the field *is called*, and answering them behind a collapsed
 * heading was the one thing every visit had to open first.
 */
export function ShapeSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, update } = editor
  const descriptor = fieldTypeOf(draft.elementType)

  return (
    <EditorSection title="Shape" icon={descriptor.glyph} badge={descriptor.label}>
      <TypeChooser
        elementType={draft.elementType}
        usageType={draft.usageType}
        onChange={(patch) => update(patch)}
      />
    </EditorSection>
  )
}
