import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fieldsApi, fieldWriteApi, tagsApi, type EntityTags, type Tag, type TagStats } from "@/api/fields"
import type { FieldDetail, FieldSummary } from "@/types"

/**
 * The field catalogue — every reusable definition in the installation.
 *
 * ⚠️ **A field is not owned by a form.** The same "Manufacturer" is on six forms and is one row, so a
 * write here invalidates the forms too: a renamed field changes what every form carrying it displays.
 */
const FIELD_KEYS = {
  all: ["fields"] as const,
  tagStats: (entityKind: string) => ["tags", "stats", entityKind] as const,
  taggedEntities: (tagId: string) => ["tags", "entities", tagId] as const,
  entityTags: (entityId: string) => ["tags", "of", entityId] as const,
}

export function useFields() {
  return useQuery<FieldSummary[]>({
    queryKey: FIELD_KEYS.all,
    queryFn: () => fieldsApi.list().then((response) => response.data),
  })
}

function useFieldMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIELD_KEYS.all })
      queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}

export function useCreateField() {
  return useFieldMutation((payload: Parameters<typeof fieldWriteApi.create>[0]) =>
    fieldWriteApi.create(payload).then((response) => response.data),
  )
}

export function useUpdateField() {
  return useFieldMutation(({ fieldId, ...payload }: { fieldId: string } & Parameters<typeof fieldWriteApi.update>[1]) =>
    fieldWriteApi.update(fieldId, payload).then((response) => response.data),
  )
}

/**
 * ⚠️ **Refused while a form still carries it**, and the refusal is the backend's. A screen that hid the
 * control instead would have to know every form's schema to decide, and would be wrong the moment
 * somebody attached the field on another tab.
 */
export function useDeleteField() {
  return useFieldMutation((fieldId: string) => fieldWriteApi.delete(fieldId).then(() => undefined))
}

export function useFieldDetail(fieldId: string | undefined) {
  return useQuery<FieldDetail>({
    queryKey: ["fields", fieldId],
    queryFn: () => fieldsApi.get(fieldId!).then((response) => response.data),
    enabled: Boolean(fieldId),
  })
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function useTagStats(entityKind: string) {
  return useQuery<TagStats[]>({
    queryKey: FIELD_KEYS.tagStats(entityKind),
    queryFn: () => tagsApi.getStats(entityKind).then((response) => response.data),
    staleTime: 60_000,
  })
}

/**
 * Which things carry one tag.
 *
 * ⚠️ **Asked only when a tag is actually chosen.** It is a whole-table read per tag, and a screen that
 * prefetched every tag's members would fetch the catalogue once per tag to draw a filter list.
 */
export function useEntityIdsByTag(tagId: string | undefined) {
  return useQuery<string[]>({
    queryKey: FIELD_KEYS.taggedEntities(tagId ?? ""),
    queryFn: () => tagsApi.getEntityIdsByTag(tagId!).then((response) => response.data),
    enabled: Boolean(tagId),
  })
}

export function useTags(entityKind: string) {
  return useQuery<Tag[]>({
    queryKey: ["tags", entityKind],
    queryFn: () => tagsApi.listByEntityKind(entityKind).then((response) => response.data),
    staleTime: 60_000,
  })
}

/** What one thing carries. Asked per thing, so it is only fetched where an editor is actually shown. */
export function useEntityTags(entityId: string | undefined) {
  return useQuery<EntityTags>({
    queryKey: FIELD_KEYS.entityTags(entityId ?? ""),
    queryFn: () => tagsApi.getEntityTags(entityId!).then((response) => response.data),
    enabled: Boolean(entityId),
  })
}

/**
 * Set what a thing carries.
 *
 * ⚠️ **Every tag query is invalidated, not just this thing's.** A tag applied here changes the count
 * beside it in the filter panel and can bring a tag into existence that no list had heard of — a
 * narrower invalidation leaves a filter that cannot find what was just filed under it.
 */
export function useSetEntityTags() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entityId, entityKind, tagNames }: { entityId: string; entityKind: string; tagNames: string[] }) =>
      tagsApi.setEntityTags(entityId, entityKind, tagNames).then((response) => response.data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: FIELD_KEYS.entityTags(variables.entityId) })
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}
