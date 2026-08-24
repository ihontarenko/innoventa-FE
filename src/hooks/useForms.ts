import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formsApi } from "@/api/forms"
import { fieldsApi } from "@/api/fields"
import type { FieldCondition, FieldDetail, FieldSummary, FormDetail } from "@/types"

/** Everything below invalidates this one key, because every write answers with the whole form. */
function formKey(formId: string) {
  return ["forms", formId] as const
}

export function useForm(formId: string | undefined) {
  return useQuery<FormDetail>({
    queryKey: formKey(formId ?? ""),
    queryFn: () => formsApi.get(formId!).then((response) => response.data),
    enabled: !!formId,
  })
}

export function useField(fieldId: string | undefined) {
  return useQuery<FieldDetail>({
    queryKey: ["fields", fieldId],
    queryFn: () => fieldsApi.get(fieldId!).then((response) => response.data),
    enabled: !!fieldId,
  })
}

export function useEligibleFields() {
  return useQuery<FieldSummary[]>({
    queryKey: ["fields", "eligible"],
    queryFn: () => fieldsApi.listEligible().then((response) => response.data),
    staleTime: 60_000,
  })
}

/**
 * ⚠️ **Every write answers with the whole form, and the answer is written straight into the cache.**
 * Invalidating instead would refetch the thing the server just handed over — and for a reorder that
 * round trip is exactly the window in which the list flickers back to its old order.
 */
function useFormMutation<Variables>(
  formId: string,
  mutationFunction: (variables: Variables) => Promise<{ data: FormDetail }>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: Variables) => mutationFunction(variables).then((response) => response.data),
    onSuccess: (form) => queryClient.setQueryData(formKey(formId), form),
  })
}

export function useAttachField(formId: string) {
  return useFormMutation<string>(formId, (fieldId) => formsApi.attachField(formId, fieldId))
}

export function useDetachField(formId: string) {
  return useFormMutation<string>(formId, (fieldId) => formsApi.detachField(formId, fieldId))
}

export function useMoveField(formId: string) {
  return useFormMutation<{ fieldId: string; direction: 1 | -1 }>(formId, ({ fieldId, direction }) =>
    formsApi.moveField(formId, fieldId, direction),
  )
}

/**
 * Dragging a field to a position, expressed in the steps the backend actually offers.
 *
 * ⚠️ **Sequential on purpose.** Each move answers with the reordered form, and firing them together
 * would have every call computing from the order before the drag — the field would end up one step
 * from where it started, not where it was dropped.
 */
export function useMoveFieldTo(formId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fieldId, from, to }: { fieldId: string; from: number; to: number }) => {
      const direction: 1 | -1 = to > from ? 1 : -1
      let form: FormDetail | undefined

      for (let step = 0; step < Math.abs(to - from); step += 1) {
        form = (await formsApi.moveField(formId, fieldId, direction)).data
      }

      return form
    },
    onSuccess: (form) => {
      if (form) {
        queryClient.setQueryData(formKey(formId), form)
      }
    },
  })
}

export function useSetFieldCondition(formId: string) {
  return useFormMutation<{ fieldId: string; condition: FieldCondition }>(formId, ({ fieldId, condition }) =>
    formsApi.setFieldCondition(formId, fieldId, condition),
  )
}

export function useClearFieldCondition(formId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fieldId: string) => formsApi.clearFieldCondition(formId, fieldId).then(() => undefined),
    // ⚠️ The only write here that does NOT answer with the form, so this one has to refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: formKey(formId) }),
  })
}
