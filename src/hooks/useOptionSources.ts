import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { optionSourcesApi, type OptionPage, type OptionSourceDescriptor } from "@/api/optionSources"

export function useOptionSourceDescriptors() {
  return useQuery<OptionSourceDescriptor[]>({
    queryKey: ["option-sources"],
    queryFn: () => optionSourcesApi.list().then((response) => response.data),
    // A registry of providers changes with a deployment, not with a session.
    staleTime: 10 * 60_000,
  })
}

/**
 * One page of a field's choices.
 *
 * ⚠️ **Refetched on open and on what has been typed — nothing else.** Choices may depend on the draft
 * entry, so keying on `draftValues` would refetch on every keystroke in a neighbouring field. The one
 * stale case — a dependency changed while this picker is already open — closes the moment anything is
 * chosen, and the values are still *sent* so the answer is correct when it is asked for.
 */
export function useFieldOptions(
  fieldId: string,
  query: string,
  draftValues: Record<string, string>,
  enabled: boolean,
) {
  return useQuery<OptionPage>({
    queryKey: ["fields", fieldId, "options", query],
    queryFn: () =>
      optionSourcesApi.optionsFor(fieldId, { query: query || null, draftValues }).then((response) => response.data),
    enabled,
    // Keeps the list on screen while a search narrows it, instead of blanking between keystrokes.
    placeholderData: keepPreviousData,
  })
}

/**
 * What a configuration would offer, before it is saved.
 *
 * ⚠️ **This is what makes configuring a source not blind.** Without it somebody sets four parameters,
 * saves, opens a form and finds an empty dropdown with nothing to say why.
 */
export function useOptionPreview(source: string, parameters: Record<string, string>, enabled: boolean) {
  return useQuery<OptionPage>({
    queryKey: ["option-sources", "preview", source, parameters],
    queryFn: () => optionSourcesApi.preview({ source, parameters }).then((response) => response.data),
    enabled,
    retry: false,
  })
}
