import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { valueSynonymsApi, type ValueSynonym } from "@/api/valueSynonyms"

const SYNONYM_KEY = ["value-synonyms"] as const

/**
 * ⚠️ **Seeded mappings and this workspace's own arrive in one list**, distinguished by `global`. Two
 * queries would let one arrive without the other, and a screen showing half the mappings in force is a
 * screen somebody uses to conclude a mapping is missing.
 */
export function useValueSynonyms() {
  return useQuery<ValueSynonym[]>({
    queryKey: SYNONYM_KEY,
    queryFn: () => valueSynonymsApi.list().then((response) => response.data),
  })
}

function useSynonymMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SYNONYM_KEY }),
  })
}

export function useCreateValueSynonym() {
  return useSynonymMutation((payload: Parameters<typeof valueSynonymsApi.create>[0]) =>
    valueSynonymsApi.create(payload).then((response) => response.data),
  )
}

export function useUpdateValueSynonym() {
  return useSynonymMutation(
    ({ synonymId, ...payload }: { synonymId: string } & Parameters<typeof valueSynonymsApi.update>[1]) =>
      valueSynonymsApi.update(synonymId, payload).then((response) => response.data),
  )
}

export function useDeleteValueSynonym() {
  return useSynonymMutation((synonymId: string) => valueSynonymsApi.delete(synonymId).then(() => undefined))
}
