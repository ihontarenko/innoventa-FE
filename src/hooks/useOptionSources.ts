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
 * ⚠️ **The draft is part of the KEY, not just part of the request — and that is the whole correctness
 * of a dependent picker.** Choices may depend on a neighbouring field: *Part* offers the entries of
 * whichever type *Type* currently holds. Keying only on the field and the search term tells react-query
 * that two questions with different answers are the same question, so choosing a type and re-opening
 * the picker was answered out of the cache — a buzzer type listing a resistor.
 *
 * ⚠️ **This was left out on purpose once, on the grounds that keying on the draft would refetch on
 * every keystroke in a neighbouring field.** It does not: the query runs only while the picker is open
 * (`enabled`), and a picker is a popover holding focus, so there is no neighbouring field to type in
 * while it is. The worry was real and the cost it feared is not.
 *
 * ⚠️ **The values are hashed by content, not by identity**, so a fresh object on every render — which
 * is what a form's state is — does not refetch anything on its own.
 */
export function useFieldOptions(
  fieldId: string,
  query: string,
  draftValues: Record<string, string>,
  enabled: boolean,
) {
  return useQuery<OptionPage>({
    queryKey: ["fields", fieldId, "options", query, draftValues],
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
