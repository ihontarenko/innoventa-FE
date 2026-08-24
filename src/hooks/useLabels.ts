import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { labelTemplatesApi, labelsApi } from "@/api/labels"
import type { SpaceModule } from "@/api/entitlements"
import { useSpaceModules } from "@/hooks/useSpaceSettings"
import { useSpaceStore } from "@/stores/spaceStore"
import type {
  LabelElement,
  LabelPlaceholder,
  LabelRecordChoice,
  LabelSubjectDescriptor,
  LabelTemplateDetail,
  LabelTemplateSummary,
  ResolvedLabelRecord,
  SaveLabelTemplatePayload,
} from "@/types"

/**
 * The workspace's label designs.
 *
 * ⚠️ **Keyed without a workspace id on purpose**: every one of these calls is scoped by the active
 * workspace header, and switching workspace already clears the cache — the same shape the storage
 * locations use.
 */
const TEMPLATES_KEY = ["label-templates"]

export function useLabelTemplates() {
  return useQuery<LabelTemplateSummary[]>({
    queryKey: TEMPLATES_KEY,
    queryFn: () => labelTemplatesApi.list().then((response) => response.data),
    staleTime: 60_000,
  })
}

export function useLabelTemplate(templateId: string | undefined) {
  return useQuery<LabelTemplateDetail>({
    queryKey: ["label-template", templateId],
    queryFn: () => labelTemplatesApi.detail(templateId!).then((response) => response.data),
    enabled: !!templateId,
  })
}

export function useCreateLabelTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SaveLabelTemplatePayload) =>
      labelTemplatesApi.create(payload).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  })
}

export function useUpdateLabelTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, ...payload }: SaveLabelTemplatePayload & { templateId: string }) =>
      labelTemplatesApi.update(templateId, payload).then((response) => response.data),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
      queryClient.invalidateQueries({ queryKey: ["label-template", template.id] })
    },
  })
}

/** ⚠️ A copy owned by whoever pressed it — how a 12×40 arrives from somebody else's 58×40. */
export function useDuplicateLabelTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => labelTemplatesApi.duplicate(templateId).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  })
}

export function useDeleteLabelTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => labelTemplatesApi.delete(templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  })
}

// ── What a label may say ─────────────────────────────────────────────────────

export function useLabelSubjects() {
  return useQuery<LabelSubjectDescriptor[]>({
    queryKey: ["label-subjects"],
    queryFn: () => labelsApi.subjects().then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

/** The fields of a bound form, in the order the form itself says they matter. */
export function useLabelFields(kind: string | undefined, formId: string | undefined) {
  return useQuery<LabelPlaceholder[]>({
    queryKey: ["label-fields", kind, formId],
    queryFn: () => labelsApi.fields(kind!, formId!).then((response) => response.data),
    enabled: !!kind && !!formId,
  })
}

/** Real records this template could be about — what the studio previews against. */
export function useLabelRecordChoices(templateId: string | undefined) {
  return useQuery<LabelRecordChoice[]>({
    queryKey: ["label-record-choices", templateId],
    queryFn: () => labelsApi.records(templateId!).then((response) => response.data),
    enabled: !!templateId,
  })
}

/**
 * One record's worth of resolved content, for the studio's live preview.
 *
 * ⚠️ **The design being edited is SENT, not just its cache key.** The obvious version — key the query on
 * the design and ask the server for the template id — previews whatever was last *saved*, so a freshly
 * added element draws blank until somebody presses Save. That is the opposite of "a mistake is seen
 * while typing".
 *
 * The debounce is the caller's: it settles the design before handing it here, the same shape the live
 * jME blocks use.
 */
export function useResolvedLabel(
  templateId: string | undefined,
  recordId: string | undefined,
  settledDesign: LabelElement[] | undefined,
) {
  const designKey = settledDesign ? JSON.stringify(settledDesign) : ""

  return useQuery<ResolvedLabelRecord | null>({
    queryKey: ["label-preview", templateId, recordId, designKey],
    queryFn: () =>
      labelsApi.resolve(templateId!, [recordId!], settledDesign).then((response) => response.data[0] ?? null),
    enabled: !!templateId && !!recordId,
    // A preview is about the design being edited, not about the record changing underneath it.
    staleTime: 5 * 60_000,
  })
}

/**
 * Whether this workspace prints labels at all.
 *
 * ⚠️ **Nothing about printing is offered where the answer is no — absent rather than disabled.** A
 * switch that removed a menu item and left a button behind would be a promise the settings screen does
 * not keep.
 */
export function useLabelsModule(): boolean {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const { data: modules = [] } = useSpaceModules(activeSpaceId ?? undefined)

  return modules.some((module: SpaceModule) => module.key === "labels" && module.enabled)
}

/**
 * The designs that could serve a record on this form — what a print picker offers.
 *
 * ⚠️ **Silent where the module is off.** This is asked from the ordinary record screens, which exist in
 * every workspace, while labels are a module most of them do not have. A component cannot gate it by
 * returning early — a hook runs before the return that would have stopped it — so the question is not
 * asked at all rather than asked and refused. Asked, it came back `403 · ceiling` and surfaced as a
 * full-screen "Not available in this workspace" over a record somebody had just opened, for a button
 * that was never going to be drawn.
 */
export function useLabelTemplatesForForm(formId: string | undefined) {
  const printable = useLabelsModule()

  return useQuery<LabelTemplateSummary[]>({
    queryKey: ["label-templates-for-form", formId],
    queryFn: () => labelTemplatesApi.forForm(formId!).then((response) => response.data),
    enabled: printable && !!formId,
  })
}


// ── Sharing ──────────────────────────────────────────────────────────────────

/** Which workspaces this design has been put into. */
export function useLabelShares(templateId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ["label-shares", templateId],
    queryFn: () => labelTemplatesApi.shares(templateId!).then((response) => response.data),
    enabled: !!templateId,
  })
}

export function useShareLabelTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, spaceIds }: { templateId: string; spaceIds: string[] }) =>
      labelTemplatesApi.share(templateId, spaceIds).then((response) => response.data),
    onSuccess: (_shares, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["label-shares", templateId] })
      queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
  })
}
