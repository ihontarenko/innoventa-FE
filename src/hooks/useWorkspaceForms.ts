import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  entriesApi,
  entryResultsApi,
  formPurposesApi,
  formWriteApi,
  formsApi,
  submissionPolicyApi,
  type Page,
} from "@/api/forms"
import { spaceSettingsApi, type SpaceForm } from "@/api/spaces"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FormAudience, FormCategory, FormEntry, FormPurpose, FormSummary, SubmissionPolicy } from "@/types"

/**
 * The workspace's own view of forms — which it shows, what they have collected, and the vocabulary
 * (purposes and categories) they are filed under.
 *
 * ⚠️ **Every write invalidates `["forms"]` and `["spaces"]` both.** A form created into a workspace is a
 * fact about the form *and* about the workspace's list, and a screen that refreshed one of them would
 * show a form nobody can find, or a list with a hole in it.
 */
const FORM_KEYS = {
  all: ["forms"] as const,
  purposes: ["forms", "purposes"] as const,
  categories: (purposeId: string) => ["forms", "purposes", purposeId, "categories"] as const,
  entries: (formId: string, spaceId: string | null, page: number, size: number) =>
    ["forms", formId, "entries", spaceId, page, size] as const,
  entryCount: (formId: string, spaceId: string | null) => ["forms", formId, "entries", "count", spaceId] as const,
}

/**
 * The forms this workspace shows.
 *
 * ⚠️ **Read from the workspace, not filtered out of every form.** Which forms a workspace shows is the
 * workspace's own decision — see its settings screen — so a filter here would be the browser answering a
 * question the backend owns, and answering it differently.
 */
export function useWorkspaceForms(purposeCode?: string) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<SpaceForm[]>({
    queryKey: ["spaces", spaceId, "forms", purposeCode ?? "all"],
    // ⚠️ A page of 500 rather than a page control. A workspace showing more forms than that is a real
    // thing to page, and a real thing to notice — but a catalogue screen that pages at twenty makes
    // grouping by category meaningless, because a category could be split across two pages.
    queryFn: () =>
      spaceSettingsApi.formsPaged(spaceId!, 0, 500, purposeCode).then((response) => response.data.content),
    enabled: Boolean(spaceId),
  })
}

export function usePurposes() {
  return useQuery<FormPurpose[]>({
    queryKey: FORM_KEYS.purposes,
    queryFn: () => formPurposesApi.listPurposes().then((response) => response.data),
    // A purpose is configuration, not content: it changes when somebody edits it, not mid-visit.
    staleTime: 5 * 60_000,
  })
}

export function useCategories(purposeId?: string) {
  return useQuery<FormCategory[]>({
    queryKey: FORM_KEYS.categories(purposeId ?? ""),
    queryFn: () => formPurposesApi.listCategories(purposeId!).then((response) => response.data),
    enabled: Boolean(purposeId),
    staleTime: 5 * 60_000,
  })
}

function useFormMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FORM_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["spaces"] })
    },
  })
}

export function useCreateForm() {
  return useFormMutation(
    (payload: {
      name: string
      description?: string
      icon?: string
      purposeId?: string
      categoryId?: string
      spaceId?: string
      audience?: FormAudience
    }) => formWriteApi.create(payload).then((response) => response.data),
  )
}

export function usePatchForm() {
  return useFormMutation(({ formId, ...payload }: { formId: string } & Parameters<typeof formWriteApi.patch>[1]) =>
    formWriteApi.patch(formId, payload).then((response) => response.data),
  )
}

export function useDeleteForm() {
  return useFormMutation((formId: string) => formWriteApi.delete(formId).then(() => undefined))
}

export function useCreatePurpose() {
  return useFormMutation((payload: { code: string; label: string; description?: string; icon?: string; sortOrder?: number }) =>
    formPurposesApi.createPurpose(payload).then((response) => response.data),
  )
}

export function useUpdatePurpose() {
  return useFormMutation(
    ({ purposeId, ...payload }: { purposeId: string; label?: string; description?: string; icon?: string; sortOrder?: number }) =>
      formPurposesApi.updatePurpose(purposeId, payload).then((response) => response.data),
  )
}

export function useDeletePurpose() {
  return useFormMutation((purposeId: string) => formPurposesApi.deletePurpose(purposeId).then(() => undefined))
}

export function useCreateCategory() {
  return useFormMutation(
    (payload: { purposeId: string; name: string; description?: string; icon?: string; sortOrder?: number }) =>
      formPurposesApi.createCategory(payload).then((response) => response.data),
  )
}

export function useUpdateCategory() {
  return useFormMutation(
    ({ categoryId, ...payload }: { categoryId: string; name?: string; description?: string; icon?: string; sortOrder?: number }) =>
      formPurposesApi.updateCategory(categoryId, payload).then((response) => response.data),
  )
}

export function useDeleteCategory() {
  return useFormMutation((categoryId: string) => formPurposesApi.deleteCategory(categoryId).then(() => undefined))
}

// ── Entries ──────────────────────────────────────────────────────────────────

/**
 * @param query narrows to entries where something written on them contains this. ⚠️ **Part of the key**,
 *              so a search is a different question rather than a re-render of the previous answer — and
 *              **matched by the database**, not by filtering the page in hand, which would report "3 of
 *              800" after looking at twenty-five.
 */
export function useEntries(
  formId: string | undefined,
  page = 0,
  size = 25,
  query?: string,
  jmq?: { filter?: string | null; order?: string | null },
) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  // ⚠️ Part of the key, like the search: a filter is a different QUESTION, not a re-render of the
  // previous answer — and the answer comes from the database, so "3 of 800" is the real count rather
  // than what a page in hand happens to contain.
  return useQuery<Page<FormEntry>>({
    queryKey: [
      ...FORM_KEYS.entries(formId ?? "", spaceId, page, size),
      query ?? null,
      jmq?.filter ?? null,
      jmq?.order ?? null,
    ],
    queryFn: () =>
      entriesApi
        .list(formId!, page, size, spaceId ?? undefined, query || undefined, jmq?.filter, jmq?.order)
        .then((response) => response.data),
    enabled: Boolean(formId),
    placeholderData: keepPreviousData,
  })
}

export function useEntryCount(formId: string | undefined) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<{ count: number }>({
    queryKey: FORM_KEYS.entryCount(formId ?? "", spaceId),
    queryFn: () => entriesApi.count(formId!, spaceId ?? undefined).then((response) => response.data),
    enabled: Boolean(formId),
  })
}

/**
 * ⚠️ **Entry writes invalidate the form's entries, never the whole `["forms"]` prefix.** Adding a row
 * does not change what a form *is*, and refetching the catalogue after every submission is how a screen
 * with twenty cards flickers on each save.
 *
 * ⚠️ **Three keys, because a row is counted in three places.** The form's own page, the purpose-wide
 * list the *All types* view reads, and the counts beside every type in the filter panel — miss one and a
 * new component appears in the table while the sidebar still says the old number.
 */
function useEntryMutation<Variables extends { formId: string }, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["forms", variables.formId, "entries"] })
      queryClient.invalidateQueries({ queryKey: ["results"] })
      queryClient.invalidateQueries({ queryKey: ["entry-counts"] })
    },
  })
}

export function useCreateEntry() {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useEntryMutation(({ formId, fieldValues }: { formId: string; fieldValues: Record<string, string> }) =>
    entriesApi.create(formId, fieldValues, spaceId ?? undefined).then((response) => response.data),
  )
}

export function useUpdateEntry() {
  return useEntryMutation(
    ({ formId, entryId, fieldValues }: { formId: string; entryId: string; fieldValues: Record<string, string> }) =>
      entriesApi.update(formId, entryId, fieldValues).then((response) => response.data),
  )
}

export function useDeleteEntry() {
  return useEntryMutation(({ formId, entryId }: { formId: string; entryId: string }) =>
    entriesApi.delete(formId, entryId).then(() => undefined),
  )
}


// ── Every form, wherever it is placed ────────────────────────────────────────

/**
 * Every form this reader may see, not only the ones this workspace shows.
 *
 * ⚠️ **A second question, not a wider filter.** A form is installation-wide and a workspace *shows* a
 * subset of them; this asks the first question and {@link useWorkspaceForms} asks the second. The
 * library offers both because attaching a form to a workspace means finding one that is not in it yet.
 */
export function useAllForms(enabled = true) {
  return useQuery<Page<FormSummary>>({
    queryKey: ["forms", "all"],
    queryFn: () => formsApi.list(0, 500).then((response) => response.data),
    enabled,
  })
}

// ── Sharing ─────────────────────────────────────────────────────────────────

/** ⚠️ Answers with the token, so the link is available without a refetch. */
export function useShareForm() {
  return useFormMutation((formId: string) => formWriteApi.enableSharing(formId).then((response) => response.data))
}

export function useUnshareForm() {
  return useFormMutation((formId: string) => formWriteApi.disableSharing(formId).then(() => undefined))
}

// ── Submission policy ───────────────────────────────────────────────────────

/**
 * What a public form does when the same person answers twice.
 *
 * ⚠️ **404 means unrestricted, and is not an error.** A form nobody has constrained has no policy row;
 * treating that as a failure would put a red state on the ordinary case and hide the editor that would
 * create one.
 */
export function useSubmissionPolicy(formId: string | undefined) {
  return useQuery<SubmissionPolicy | null>({
    queryKey: ["forms", formId, "submission-policy"],
    queryFn: () =>
      submissionPolicyApi
        .get(formId!)
        .then((response) => response.data)
        .catch((error: { response?: { status?: number } }) => {
          if (error.response?.status === 404) {
            return null
          }

          throw error
        }),
    enabled: Boolean(formId),
  })
}

function useSubmissionPolicyMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FORM_KEYS.all }),
  })
}

export function useSaveSubmissionPolicy() {
  return useSubmissionPolicyMutation(
    ({ formId, ...payload }: { formId: string } & Parameters<typeof submissionPolicyApi.save>[1]) =>
      submissionPolicyApi.save(formId, payload).then((response) => response.data),
  )
}

/** ⚠️ How a form goes back to unrestricted — never a save with the limits blanked, which permits
    everything while reading as though somebody meant something by it. */
export function useDeleteSubmissionPolicy() {
  return useSubmissionPolicyMutation((formId: string) => submissionPolicyApi.delete(formId).then(() => undefined))
}

// ── Everything of a purpose ─────────────────────────────────────────────────

/**
 * Every entry of a purpose, across every form carrying it.
 *
 * ⚠️ **The workspace travels as an argument, and it is part of the key.** Switching workspace has to
 * refetch rather than re-render the previous one's rows — and passing no workspace deliberately asks for
 * every workspace *plus* the space-less public submissions, which is a different question, not a
 * broader one.
 */
export function useEntriesByPurpose(
  purposeCode: string | undefined,
  page = 0,
  size = 25,
  {
    /** `false` narrows to this reader's own submissions. */
    everybody = true,
    /**
     * ⚠️ **`false` deliberately asks a *different* question, not a broader one.** With no workspace the
     * backend answers with every workspace **plus** the space-less public submissions — the ones a
     * landing-page form or a bug report produce, which belong to nobody's workspace and are invisible
     * from inside one.
     */
    scopedToWorkspace = true,
    refetchMilliseconds,
    /** Narrows to entries where something written on them contains this. Matched by the database. */
    query,
  }: {
    everybody?: boolean
    scopedToWorkspace?: boolean
    refetchMilliseconds?: number
    query?: string
  } = {},
) {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const spaceId = scopedToWorkspace ? (activeSpaceId ?? undefined) : undefined

  return useQuery<Page<FormEntry>>({
    queryKey: ["results", purposeCode, spaceId ?? null, everybody, page, size, query ?? null],
    queryFn: () =>
      entryResultsApi
        .byPurpose(purposeCode!, everybody, page, size, spaceId, query || undefined)
        .then((response) => response.data),
    enabled: Boolean(purposeCode),
    placeholderData: keepPreviousData,
    staleTime: refetchMilliseconds ? 0 : 30_000,
    refetchInterval: refetchMilliseconds,
  })
}

/**
 * How many entries each of these forms holds.
 *
 * ⚠️ **One call for the whole sidebar.** A count beside every type, asked form by form, is thirty
 * requests to draw a filter panel — and thirty chances for the panel to finish drawing at thirty
 * different moments.
 */
export function useEntryCounts(formIds: string[]) {
  const spaceId = useSpaceStore((state) => state.activeSpaceId)

  return useQuery<Record<string, number>>({
    // ⚠️ Sorted into the key: the same set of forms asked in a different order is the same question,
    // and an unsorted key would cache it twice and refetch on every re-render that reorders the list.
    queryKey: ["entry-counts", spaceId, [...formIds].sort().join(",")],
    queryFn: () =>
      entryResultsApi
        .batchCount(formIds, spaceId ?? undefined)
        .then((response) => Object.fromEntries(response.data.map((row) => [row.formId, row.count]))),
    enabled: formIds.length > 0,
    staleTime: 30_000,
  })
}

/**
 * One row, by its identifier.
 *
 * ⚠️ **Needed because a *reference* to an entry carries no values.** A parametric match, a link, a
 * search hit all name a row and say almost nothing about it; opening one means fetching it.
 */
export function useEntry(formId: string | undefined, entryId: string | undefined) {
  return useQuery<FormEntry>({
    queryKey: ["forms", formId, "entries", "one", entryId],
    queryFn: () => entriesApi.get(formId!, entryId!).then((response) => response.data),
    enabled: Boolean(formId && entryId),
  })
}
