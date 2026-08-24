import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  inspectionsApi,
  maintenanceApi,
  monitoringApi,
  readingsApi,
  type AssetInspection,
  type CompleteMaintenanceRequest,
  type CurrentValue,
  type DueAnswer,
  type DueState,
  type InspectionBoardEntry,
  type MaintenanceBoardEntry,
  type OfferedKind,
  type InspectionOutcome,
  type MaintenanceEvent,
  type MaintenancePlan,
  type PlanRequest,
  type EquipmentMetric,
  type MetricRequest,
  type RecordedReading,
  type RecordReadingRequest,
  type WatchState,
} from "@/api/monitoring"
import type { SpaceModule } from "@/api/entitlements"
import type { Page } from "@/api/forms"
import { useSpaceModules } from "@/hooks/useSpaceSettings"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Whether this workspace watches the state of its things at all.
 *
 * ⚠️ **Nothing about the watch is offered where the answer is no — absent rather than disabled**, the
 * rule `useLabelsModule` already sets. `monitoring` is a paid module most workspaces do not have, and
 * the metrics panel is opened from the form builder, which exists in every one of them.
 */
export function useMonitoringModule(): boolean {
  return useSpaceModule("monitoring")
}

/** Whether this workspace hands its things to people at all — the module the watch is never sold without. */
export function useCustodyModule(): boolean {
  return useSpaceModule("custody")
}

/**
 * ⚠️ **One question, asked by key.** Two copies of "is this module on" drift the day one of them starts
 * treating an absent module as enabled.
 */
function useSpaceModule(key: string): boolean {
  const activeSpaceId = useSpaceStore((store) => store.activeSpaceId)
  const { data: modules = [] } = useSpaceModules(activeSpaceId ?? undefined)

  return modules.some((module: SpaceModule) => module.key === key && module.enabled)
}

/**
 * Whether anybody has set the watch up here at all.
 *
 * ⚠️ **Three counts to tell three empties apart** — calm, nothing watched, nothing configured. An
 * attention board with nothing on it reads the same in all three, and that ambiguity is what made the
 * whole feature look broken to somebody opening it for the first time.
 */
export function useWatchState() {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)
  const watchesEquipment = useMonitoringModule()

  return useQuery<WatchState>({
    queryKey: ["monitoring", "state", spaceId],
    queryFn: () => monitoringApi.state().then((response) => response.data),
    enabled: Boolean(spaceId) && watchesEquipment,
    staleTime: 60_000,
  })
}

/** The kinds of thing this workspace can start from, and which of them it already has. */
export function useEquipmentSeeds() {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)
  const watchesEquipment = useMonitoringModule()

  return useQuery<OfferedKind[]>({
    queryKey: ["monitoring", "seeds", spaceId],
    queryFn: () => monitoringApi.seeds().then((response) => response.data),
    enabled: Boolean(spaceId) && watchesEquipment,
  })
}

/**
 * Takes one kind of thing.
 *
 * ⚠️ **Invalidates the form catalogue too, not only monitoring.** A seed places a FORM, so the asset
 * pickers, the register dialog and the Watch screen's own list are all stale the moment it lands —
 * and a new kind that does not appear until a reload reads as the button having failed.
 */
export function useApplyEquipmentSeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => monitoringApi.applySeed(code).then((response) => response.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["monitoring"] })
      await queryClient.invalidateQueries({ queryKey: ["custody"] })
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}

/**
 * What this workspace measures about the things a form describes.
 *
 * ⚠️ **Not asked where the module is off.** A hook runs before any early return that would have stopped
 * it, so the question has to be withheld here rather than in the component — asked without the module
 * it comes back refused at the ceiling and surfaces as a failed request nobody made on purpose.
 */
export function useMetrics(formId: string | undefined, enabled = true) {
  return useQuery<EquipmentMetric[]>({
    queryKey: ["monitoring", "metrics", formId],
    queryFn: () => monitoringApi.metrics(formId!).then((response) => response.data),
    enabled: Boolean(formId) && enabled,
  })
}

function useMetricMutation<Variables extends { formId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({ queryKey: ["monitoring", "metrics", variables.formId] }),
  })
}

export function useCreateMetric() {
  return useMetricMutation(({ formId, payload }: { formId: string; payload: MetricRequest }) =>
    monitoringApi.createMetric(formId, payload).then((response) => response.data),
  )
}

export function useUpdateMetric() {
  return useMetricMutation(
    ({ formId, metricId, payload }: { formId: string; metricId: string; payload: MetricRequest }) =>
      monitoringApi.updateMetric(formId, metricId, payload).then((response) => response.data),
  )
}

export function useDeleteMetric() {
  return useMetricMutation(({ formId, metricId }: { formId: string; metricId: string }) =>
    monitoringApi.deleteMetric(formId, metricId).then((response) => response.data),
  )
}

export function useReorderMetrics() {
  return useMetricMutation(({ formId, metricIds }: { formId: string; metricIds: string[] }) =>
    monitoringApi.reorderMetrics(formId, metricIds).then((response) => response.data),
  )
}

/**
 * The newest number for every metric this thing is measured by.
 *
 * ⚠️ Withheld where the module is off, like every other question in this file — the asset drawer exists
 * in every workspace, and the watch does not.
 */
export function useCurrentValues(assetId: string | undefined, enabled = true) {
  return useQuery<CurrentValue[]>({
    queryKey: ["monitoring", "current", assetId],
    queryFn: () => readingsApi.current(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
  })
}

/** The history of one metric on one thing, newest first. */
export function useReadingHistory(assetId: string | undefined, metricId: string | undefined) {
  return useQuery({
    queryKey: ["monitoring", "history", assetId, metricId],
    queryFn: () => readingsApi.history(assetId!, metricId!).then((response) => response.data),
    enabled: Boolean(assetId) && Boolean(metricId),
  })
}

/** What this thing can be measured by, most likely first — ordered by the backend, never re-sorted here. */
export function usePickableMetrics(assetId: string | undefined, enabled = true) {
  return useQuery<EquipmentMetric[]>({
    queryKey: ["monitoring", "pickable", assetId],
    queryFn: () => readingsApi.pickableMetrics(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
  })
}

/**
 * Writes one reading down.
 *
 * ⚠️ **The caller must show `warning` when it comes back.** The reading is written either way; the
 * warning is the product asking a person to say whether a counter fell because an instrument was
 * replaced or because a digit is wrong. Swallowing it is how "every 250 hours" quietly stops firing.
 */
export function useRecordReading() {
  const queryClient = useQueryClient()

  return useMutation<RecordedReading, unknown, { assetId: string; payload: RecordReadingRequest }>({
    mutationFn: ({ assetId, payload }) => readingsApi.record(assetId, payload).then((response) => response.data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "current", variables.assetId] })
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "history", variables.assetId] })
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "pickable", variables.assetId] })
    },
  })
}

// ── Maintenance ──────────────────────────────────────────────────────────────

/**
 * Every rule against every thing it governs, in this workspace.
 *
 * ⚠️ **Kept honest rather than cached hard, for the same reason the attention board is** — nothing
 * behind it is stored, so a calendar plan falls due with no write anywhere and a stale answer becomes
 * wrong without anything having happened that would invalidate it.
 */
export function useMaintenanceBoard(parameters: { state?: DueState; formId?: string } = {}) {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)
  const watchesEquipment = useMonitoringModule()

  return useQuery<MaintenanceBoardEntry[]>({
    queryKey: ["monitoring", "board", spaceId, parameters.state ?? null, parameters.formId ?? null],
    queryFn: () => maintenanceApi.board(parameters).then((response) => response.data),
    enabled: Boolean(spaceId) && watchesEquipment,
    staleTime: 30_000,
  })
}

/** The rules a class of things carries. */
export function usePlans(formId: string | undefined, enabled = true) {
  return useQuery<MaintenancePlan[]>({
    queryKey: ["monitoring", "plans", formId],
    queryFn: () => maintenanceApi.plans(formId!).then((response) => response.data),
    enabled: Boolean(formId) && enabled,
  })
}

function usePlanMutation<Variables extends { formId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({ queryKey: ["monitoring", "plans", variables.formId] }),
  })
}

export function useCreatePlan() {
  return usePlanMutation(({ formId, payload }: { formId: string; payload: PlanRequest }) =>
    maintenanceApi.createPlan(formId, payload).then((response) => response.data),
  )
}

export function useUpdatePlan() {
  return usePlanMutation(({ formId, planId, payload }: { formId: string; planId: string; payload: PlanRequest }) =>
    maintenanceApi.updatePlan(formId, planId, payload).then((response) => response.data),
  )
}

export function useDeletePlan() {
  return usePlanMutation(({ formId, planId }: { formId: string; planId: string }) =>
    maintenanceApi.deletePlan(formId, planId).then((response) => response.data),
  )
}

/**
 * What every rule governing this thing says about it right now.
 *
 * ⚠️ **Nothing this returns is stored** — it is derived on every request. So it is not cached hard:
 * a calendar plan falls due with no write anywhere, which means a stale cache here can be wrong
 * without anything having happened to invalidate it.
 */
export function useDueState(assetId: string | undefined, enabled = true) {
  return useQuery<DueAnswer[]>({
    queryKey: ["monitoring", "due", assetId],
    queryFn: () => maintenanceApi.due(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
    staleTime: 30_000,
  })
}

export function useMaintenanceEvents(assetId: string | undefined, enabled = true) {
  return useQuery<MaintenanceEvent[]>({
    queryKey: ["monitoring", "events", assetId],
    queryFn: () => maintenanceApi.events(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
  })
}

/** ⚠️ Freezes the reading current at this moment; a later correction of it does not move the event. */
export function useCompleteMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: CompleteMaintenanceRequest }) =>
      maintenanceApi.complete(assetId, payload).then((response) => response.data),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "due", variables.assetId] })
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "events", variables.assetId] })
      // ⚠️ The board is derived, so a service carried out here is one item fewer there — and nothing
      // else would ever tell it. Its thirty-second staleness would otherwise leave the item on screen
      // right after the press that resolved it, which reads as the press having failed.
      await queryClient.invalidateQueries({ queryKey: ["attention"] })
    },
  })
}

// ── Inspections ──────────────────────────────────────────────────────────────

/**
 * Every check carried out in this workspace.
 *
 * ⚠️ **Cached longer than the derived boards, because this one is a log.** An inspection is written and
 * never changes by itself; nothing about it falls due while nobody is looking.
 */
export function useInspectionBoard(parameters: {
  outcome?: InspectionOutcome
  formId?: string
  page?: number
  size?: number
} = {}) {
  const spaceId = useSpaceStore((store) => store.activeSpaceId)
  const watchesEquipment = useMonitoringModule()

  return useQuery<Page<InspectionBoardEntry>>({
    queryKey: [
      "monitoring",
      "inspection-board",
      spaceId,
      parameters.outcome ?? null,
      parameters.formId ?? null,
      parameters.page ?? 0,
    ],
    queryFn: () => inspectionsApi.board(parameters).then((response) => response.data),
    enabled: Boolean(spaceId) && watchesEquipment,
  })
}

export function useInspections(assetId: string | undefined, enabled = true) {
  return useQuery<AssetInspection[]>({
    queryKey: ["monitoring", "inspections", assetId],
    queryFn: () => inspectionsApi.list(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
  })
}

export function useChecklistForms(assetId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["monitoring", "checklists", assetId],
    queryFn: () => inspectionsApi.checklists(assetId!).then((response) => response.data),
    enabled: Boolean(assetId) && enabled,
  })
}

function useInspectionMutation<Variables extends { assetId: string }, Result>(
  send: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "inspections", variables.assetId] })
      await queryClient.invalidateQueries({ queryKey: ["monitoring", "due", variables.assetId] })
    },
  })
}

export function useRecordInspection() {
  return useInspectionMutation(
    ({
      assetId,
      payload,
    }: {
      assetId: string
      payload: { entryId: string; planId?: string | null; outcome: InspectionOutcome; note?: string | null }
    }) => inspectionsApi.record(assetId, payload).then((response) => response.data),
  )
}

export function useReviseOutcome() {
  return useInspectionMutation(
    ({
      assetId,
      inspectionId,
      payload,
    }: {
      assetId: string
      inspectionId: string
      payload: { outcome: InspectionOutcome; note?: string | null }
    }) => inspectionsApi.reviseOutcome(assetId, inspectionId, payload).then((response) => response.data),
  )
}
