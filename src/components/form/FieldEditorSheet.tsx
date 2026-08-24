import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@jmouse/ui"
import { fieldsApi } from "@/api/fields"
import { FieldEditor } from "@/components/form/builder/FieldEditor"
import { FieldPickerDialog } from "@/components/form/builder/FieldPickerDialog"
import { useField } from "@/hooks/useForms"
import type { FieldSummary } from "@/types"

/**
 * A field opened from the catalogue, where it belongs to no form.
 *
 * ⚠️ **The same `FieldEditor` the form builder uses**, with `form` left out. Everything a field owns is
 * editable here — label, type, choices, children, validation, attributes — and the one section that is
 * not, *Condition*, is absent because it names sibling fields and a catalogued field has none.
 *
 * ⚠️ **A second, simpler editor was the obvious shortcut and is the wrong one.** Two editors of one
 * field are two places validation and defaults can drift, and the one that drifts is always the one
 * used less. Making `form` optional cost one line in the editor.
 *
 * ⚠️ **The child picker is owned here, not by the editor.** It is a dialog over the whole screen, and
 * the editor deliberately only says *somebody asked to add a child* — the same arrangement the builder
 * has, which is why both can host it without the editor knowing where it is mounted.
 */
export function FieldEditorSheet({ fieldId, onClose }: { fieldId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [isPickingChild, setPickingChild] = useState(false)

  const { data: detail } = useField(fieldId)

  const addChild = useMutation({
    mutationFn: (childFieldId: string) => fieldsApi.addChild(fieldId, childFieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields", fieldId] })
      queryClient.invalidateQueries({ queryKey: ["fields"] })
    },
  })

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Field</SheetTitle>
          <SheetDescription className="text-xs">
            A definition, not a question on a form — where it is asked is the form's business.
          </SheetDescription>
        </SheetHeader>

        <FieldEditor fieldId={fieldId} onPickChild={() => setPickingChild(true)} />

        <FieldPickerDialog
          open={isPickingChild}
          title="Add a child field"
          excludedFieldIds={[...(detail?.children ?? []).map((child) => child.id), fieldId]}
          onPick={async (field: FieldSummary) => {
            await addChild.mutateAsync(field.id)
            setPickingChild(false)
          }}
          onClose={() => setPickingChild(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
