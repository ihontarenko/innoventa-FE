import { featureBySlug } from "@/components/features/registry"
import { useFormFeatures } from "@/hooks/useFeatures"
import type { FormEntry } from "@/types"

/**
 * The widgets a form carries, drawn against one row's answers.
 *
 * ⚠️ **Nothing at all when the form carries none, and no heading either.** Most forms have no widgets,
 * and an empty "Widgets" section on every record would be a permanent reminder of a feature nobody in
 * that workspace uses.
 *
 * ⚠️ **Values are re-keyed from field names to input keys, here.** The row stores answers by *field*;
 * a widget asks for its own slots. That translation is what the binding is *for*, and doing it once at
 * the boundary is what keeps sixteen widgets ignorant of forms entirely.
 *
 * ⚠️ **A binding whose widget this build does not implement is skipped silently — the only place that is
 * right.** The form's settings panel marks it loudly, because that is where somebody can act; a reader
 * looking at a resistor cannot install a missing widget and does not need telling.
 */
export function EntryWidgets({ formId, entry }: { formId: string; entry: FormEntry }) {
  const { data: bindings = [] } = useFormFeatures(formId)

  const drawable = bindings
    .map((binding) => ({ binding, entry: featureBySlug(binding.feature.slug) }))
    .filter((one): one is { binding: (typeof bindings)[number]; entry: NonNullable<typeof one.entry> } => !!one.entry)

  if (drawable.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-3">
      <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">What this says</span>

      {drawable.map(({ binding, entry: registered }) => {
        const Widget = registered.widget

        const values: Record<string, string> = {}

        for (const mapping of binding.fieldMappings) {
          values[mapping.inputKey] = entry.fieldValues[mapping.fieldName] ?? ""
        }

        return (
          <div key={binding.id} className="flex flex-col gap-2 rounded-md border p-3">
            <span className="text-xs font-medium">{binding.feature.name}</span>
            <Widget values={values} fieldMappings={binding.fieldMappings} />
          </div>
        )
      })}
    </section>
  )
}
