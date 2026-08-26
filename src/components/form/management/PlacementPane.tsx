import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCategories, usePatchForm, usePurposes } from "@/hooks/useWorkspaceForms"
import type { ManagedForm } from "./types"
import { Pane, PaneField, PaneGrid } from "./Pane"

/**
 * Where the form is filed.
 *
 * ⚠️ **A purpose carries behaviour; a category is only a heading.** Moving a form to `INVENTORY` makes
 * it a component type — which is why the two are edited together, and why changing the purpose empties
 * the category: the categories under one purpose mean nothing under another.
 */
export function PlacementPane({ form }: { form: ManagedForm }) {
  const { data: purposes = [] } = usePurposes()

  const [purposeId, setPurposeId] = useState(form.purpose?.id ?? "")
  const [categoryId, setCategoryId] = useState(form.category?.id ?? "")

  const { data: categories = [] } = useCategories(purposeId || undefined)
  const patchForm = usePatchForm()

  const isDirty = purposeId !== (form.purpose?.id ?? "") || categoryId !== (form.category?.id ?? "")

  function save() {
    patchForm.mutate(
      { formId: form.id, purposeId: purposeId || undefined, categoryId: categoryId || undefined },
      {
        onSuccess: () => toast.success("Placement saved."),
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not save the placement.")
        },
      },
    )
  }

  return (
    <Pane title="Placement" hint="Where this form is filed, and what answering it means.">
      <PaneGrid>
        <PaneField label="Purpose" hint="Some purposes carry behaviour — Inventory makes it a component type.">
          <PlainSelect
            value={purposeId}
            onChange={(next) => {
              setPurposeId(next)
              // ⚠️ Emptied rather than kept: a category belongs to one purpose, so carrying it across
              // would file the form under a heading that does not exist where it now lives.
              setCategoryId("")
            }}
          >
            <option value="">— none —</option>
            {purposes.map((purpose) => (
              <option key={purpose.id} value={purpose.id}>
                {purpose.icon ? `${purpose.icon} ` : ""}
                {purpose.label}
              </option>
            ))}
          </PlainSelect>
        </PaneField>

        <PaneField label="Category" hint="A heading in the library, and nothing more.">
          <PlainSelect value={categoryId} onChange={setCategoryId} disabled={!purposeId}>
            <option value="">— uncategorised —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon ? `${category.icon} ` : ""}
                {category.name}
              </option>
            ))}
          </PlainSelect>
        </PaneField>
      </PaneGrid>

      <Button size="sm" className="self-start" disabled={!isDirty || patchForm.isPending} onClick={save}>
        Save placement
      </Button>
    </Pane>
  )
}
