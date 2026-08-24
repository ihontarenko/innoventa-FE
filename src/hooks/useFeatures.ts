import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  featuresApi,
  type FeatureCatalogItem,
  type FeatureKind,
  type FormFeatureBinding,
} from "@/api/features"

/** ⚠️ Configuration, so it is cached hard — it changes when somebody deploys, not while a page is open. */
export function useFeatureCatalog(kind?: FeatureKind) {
  return useQuery<FeatureCatalogItem[]>({
    queryKey: ["features", "catalog", kind ?? "all"],
    queryFn: () => featuresApi.catalog(kind).then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

export function useFormFeatures(formId: string | undefined) {
  return useQuery<FormFeatureBinding[]>({
    queryKey: ["forms", formId, "features"],
    queryFn: () => featuresApi.listForForm(formId!).then((response) => response.data),
    enabled: Boolean(formId),
  })
}

function useBindingMutation<Variables extends { formId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({ queryKey: ["forms", variables.formId, "features"] }),
  })
}

export function useConnectFeature() {
  return useBindingMutation(({ formId, ...payload }: { formId: string } & Parameters<typeof featuresApi.connect>[1]) =>
    featuresApi.connect(formId, payload).then((response) => response.data),
  )
}

export function useUpdateFormFeature() {
  return useBindingMutation(
    ({
      formId,
      bindingId,
      ...payload
    }: { formId: string; bindingId: string } & Parameters<typeof featuresApi.update>[2]) =>
      featuresApi.update(formId, bindingId, payload).then((response) => response.data),
  )
}

export function useDisconnectFeature() {
  return useBindingMutation(({ formId, bindingId }: { formId: string; bindingId: string }) =>
    featuresApi.disconnect(formId, bindingId).then(() => undefined),
  )
}
