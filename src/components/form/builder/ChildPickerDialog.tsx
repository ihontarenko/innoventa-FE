import { useMutation, useQueryClient } from "@tanstack/react-query"
import { fieldsApi } from "@/api/fields"
import { useField } from "@/hooks/useForms"
import type { FieldSummary } from "@/types"
import { FieldPickerDialog } from "./FieldPickerDialog"

/**
 * Adding a child to a group, wherever the group is being edited.
 *
 * ⚠️ **The editor asks; this answers.** `FieldEditor` only ever says *somebody asked to add a child* —
 * the picker is a dialog over the whole screen and cannot belong to something rendered inside a row, a
 * sheet and a page in turn. Every host mounts this one component instead of carrying its own copy of
 * the mutation, the exclusion list and the invalidation, which is how the three of them used to drift.
 *
 * ⚠️ **The excluded set is the children plus the group itself.** A group that is its own child is a
 * cycle the renderer follows until the tab dies.
 */
export function ChildPickerDialog({
  fieldId,
  open,
  onClose,
}: {
  fieldId: string | null
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { data: detail } = useField(fieldId ?? undefined)

  const addChild = useMutation({
    mutationFn: (childFieldId: string) => fieldsApi.addChild(fieldId!, childFieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields", fieldId] })
      queryClient.invalidateQueries({ queryKey: ["fields"] })
      queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })

  return (
    <FieldPickerDialog
      open={open && !!fieldId}
      title="Add a child field"
      excludedFieldIds={[...(detail?.children ?? []).map((child) => child.id), ...(fieldId ? [fieldId] : [])]}
      onPick={async (field: FieldSummary) => {
        await addChild.mutateAsync(field.id)
        onClose()
      }}
      onClose={onClose}
    />
  )
}
