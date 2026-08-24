import { http } from "./http"
import type { Page } from "./forms"

/**
 * How a number behaves over time — the one bit of behaviour a metric carries.
 *
 * ⚠️ **A counter is not "a measurement that goes up".** A plan over a counter fires on the *delta since
 * the last service* ("every 250 hours"); a plan over a measurement fires on *leaving a range* ("below
 * 2 °C"). Which one a metric is decides how every plan written against it is phrased.
 */
export type MetricKind = "COUNTER" | "MEASUREMENT"

export interface EquipmentMetric {
  id: string
  formId: string
  code: string
  name: string
  unit: string | null
  kind: MetricKind
  decimalPlaces: number
  sortOrder: number
  quantityKindId: string | null
}

export interface MetricRequest {
  code: string
  name: string
  unit?: string | null
  kind: MetricKind
  decimalPlaces?: number
  quantityKindId?: string | null
}

/**
 * What a workspace measures about the things a form describes.
 *
 * ⚠️ **Addressed through the form, always.** A metric belongs to a *placement* — this form, in this
 * workspace — and the workspace half comes from the active-workspace header rather than from the path,
 * so there is no route here that could name somebody else's.
 */
/**
 * How much of the watch has been set up here.
 *
 * ⚠️ **Counts, never a verdict.** Which sentence an empty screen shows is the screen's decision; a
 * backend answering "say this" would have to be edited every time the wording changed.
 */
export interface WatchState {
  metrics: number
  plans: number
  watchedThings: number
}

/**
 * A ready-made kind of thing a workspace can start from.
 *
 * ⚠️ **`metrics` and `plans` are names, not definitions.** The picker's job is to say what somebody is
 * agreeing to before they agree to it; editing any of it afterwards is the Watch screen's, which is
 * where they already are.
 */
export interface OfferedKind {
  code: string
  name: string
  description: string
  icon: string
  metrics: string[]
  plans: string[]
  /** Whether this workspace already describes things with this kind's form. */
  present: boolean
}

/** What a workspace actually gained — a seed applied twice adds nothing twice. */
export interface AppliedKind {
  code: string
  formId: string
  formPlaced: boolean
  metrics: number
  plansAdded: number
}

export const monitoringApi = {
  state: () => http.get<WatchState>("/monitoring/state"),

  seeds: () => http.get<OfferedKind[]>("/monitoring/seeds"),

  applySeed: (code: string) => http.post<AppliedKind>(`/monitoring/seeds/${code}`),

  metrics: (formId: string) => http.get<EquipmentMetric[]>(`/monitoring/forms/${formId}/metrics`),

  createMetric: (formId: string, payload: MetricRequest) =>
    http.post<EquipmentMetric>(`/monitoring/forms/${formId}/metrics`, payload),

  updateMetric: (formId: string, metricId: string, payload: MetricRequest) =>
    http.put<EquipmentMetric>(`/monitoring/forms/${formId}/metrics/${metricId}`, payload),

  deleteMetric: (formId: string, metricId: string) =>
    http.delete<void>(`/monitoring/forms/${formId}/metrics/${metricId}`),

  reorderMetrics: (formId: string, metricIds: string[]) =>
    http.put<EquipmentMetric[]>(`/monitoring/forms/${formId}/metrics/order`, { metricIds }),
}

export interface AssetReading {
  id: string
  metricId: string
  metricCode: string
  metricName: string
  unit: string | null
  decimalPlaces: number
  value: string
  takenAt: string
  takenBy: string | null
  note: string | null
}

/**
 * The newest number for one metric on one thing.
 *
 * ⚠️ **`value` is `null` where nobody has ever recorded one, and the row still comes back.** That gap is
 * an answer — *nobody has ever looked at the motorhours on this excavator* — and a list that omitted it
 * would make the gap invisible, which is the failure mode a monitor must not have.
 */
export interface CurrentValue {
  metricId: string
  metricCode: string
  metricName: string
  unit: string | null
  decimalPlaces: number
  kind: MetricKind
  value: string | null
  takenAt: string | null
  note: string | null
}

export interface RecordReadingRequest {
  metricId: string
  value: string
  takenAt?: string | null
  note?: string | null
}

/**
 * ⚠️ **`warning` is why this is not just the reading.** A counter recorded lower than the last one is
 * written *and* remarked on; a client that drops this field turns the remark into silence, which is
 * exactly the case the flag exists for.
 */
export interface RecordedReading {
  reading: AssetReading
  warning: string | null
}

export const readingsApi = {
  current: (assetId: string) =>
    http.get<CurrentValue[]>(`/monitoring/assets/${assetId}/readings/current`),

  history: (assetId: string, metricId: string, page = 0, size = 25) =>
    http.get<{ content: AssetReading[]; totalElements: number }>(
      `/monitoring/assets/${assetId}/readings`,
      { params: { metricId, page, size } },
    ),

  pickableMetrics: (assetId: string) =>
    http.get<EquipmentMetric[]>(`/monitoring/assets/${assetId}/metrics`),

  record: (assetId: string, payload: RecordReadingRequest) =>
    http.post<RecordedReading>(`/monitoring/assets/${assetId}/readings`, payload),
}

// ── Maintenance ──────────────────────────────────────────────────────────────

export type TriggerKind = "COUNTER" | "CALENDAR" | "RANGE"
export type IntervalUnit = "DAY" | "MONTH" | "METRIC"

/**
 * ⚠️ **Ordered by concern, and the order is the backend's.** A caller showing one badge per asset takes
 * the highest — `OUT_OF_RANGE` outranks `OVERDUE` because a fridge at 9 °C is a problem this morning
 * while a service three days late is a problem this week.
 */
export type DueState = "OK" | "STALE" | "DUE_SOON" | "OVERDUE" | "OUT_OF_RANGE"

export interface MaintenancePlan {
  id: string
  formId: string
  name: string
  triggerKind: TriggerKind
  metricId: string | null
  metricName: string | null
  metricUnit: string | null
  intervalAmount: string | null
  intervalUnit: IntervalUnit | null
  warnAheadAmount: string | null
  rangeMinimum: string | null
  rangeMaximum: string | null
  expectedReadingIntervalDays: number | null
  sendsToService: boolean
  inspectionFormId: string | null
  inspectionFormName: string | null
  sortOrder: number
  active: boolean
}

export interface PlanRequest {
  name: string
  triggerKind: TriggerKind
  metricId?: string | null
  intervalAmount?: string | null
  intervalUnit?: IntervalUnit | null
  warnAheadAmount?: string | null
  rangeMinimum?: string | null
  rangeMaximum?: string | null
  expectedReadingIntervalDays?: number | null
  sendsToService?: boolean
  inspectionFormId?: string | null
  active?: boolean
}

/**
 * What one rule says about one thing, right now.
 *
 * ⚠️ **None of this is stored anywhere.** It is computed on every request from the readings, the plans
 * and the completed services — there is no `next_due` column to be stale, and there must never be one.
 * `explanation` carries the numbers that produced the answer, because "overdue" a person cannot check
 * is a claim rather than information.
 */
export interface DueAnswer {
  planId: string
  planName: string
  assetId: string
  triggerKind: TriggerKind
  state: DueState
  sendsToService: boolean
  dueAt: string | null
  dueAtValue: string | null
  currentValue: string | null
  originValue: string | null
  overshoot: string | null
  lastPerformedAt: string | null
  metricId: string | null
  metricName: string | null
  metricUnit: string | null
  inspectionFormId: string | null
  explanation: string
}

export interface MaintenanceEvent {
  id: string
  planId: string | null
  performedAt: string
  performedBy: string | null
  readingMetricId: string | null
  readingValue: string | null
  entryId: string | null
  note: string | null
}

/**
 * One rule, against one thing, on the workspace-wide board.
 *
 * ⚠️ **The answer is nested rather than flattened into this row.** `DueAnswer` is the shape the per-asset
 * drawer already reads, and copying its sixteen fields up a level would give the same fact two shapes and
 * two places to drift.
 */
export interface MaintenanceBoardEntry {
  assetId: string
  assetLabel: string
  formId: string | null
  formName: string | null
  answer: DueAnswer
}

/**
 * What is sent to close one plan.
 *
 * `planId` is null for work nobody scheduled — an unscheduled repair is real history, and the origin of
 * no interval. `entryId` and `outcome` travel together and only where the plan names a checklist: the
 * inspection and the event are then written as one.
 */
export interface CompleteMaintenanceRequest {
  planId?: string | null
  performedAt?: string | null
  note?: string | null
  entryId?: string | null
  outcome?: InspectionOutcome | null
}

export const maintenanceApi = {
  plans: (formId: string) => http.get<MaintenancePlan[]>(`/monitoring/forms/${formId}/plans`),

  createPlan: (formId: string, payload: PlanRequest) =>
    http.post<MaintenancePlan>(`/monitoring/forms/${formId}/plans`, payload),

  updatePlan: (formId: string, planId: string, payload: PlanRequest) =>
    http.put<MaintenancePlan>(`/monitoring/forms/${formId}/plans/${planId}`, payload),

  deletePlan: (formId: string, planId: string) =>
    http.delete<void>(`/monitoring/forms/${formId}/plans/${planId}`),

  due: (assetId: string) => http.get<DueAnswer[]>(`/monitoring/assets/${assetId}/maintenance/due`),

  /**
   * The same question asked of the whole workspace.
   *
   * ⚠️ **Filtered on the server.** Every row is derived rather than stored, so narrowing in the browser
   * would mean deriving the workspace and throwing most of it away — and a count that disagreed with the
   * rows beneath it the moment anything was hidden.
   */
  board: (parameters: { state?: DueState; formId?: string } = {}) =>
    http.get<MaintenanceBoardEntry[]>("/monitoring/maintenance", { params: parameters }),

  events: (assetId: string) =>
    http.get<MaintenanceEvent[]>(`/monitoring/assets/${assetId}/maintenance/events`),

  /**
   * Record that a service was carried out.
   *
   * ⚠️ **`/complete`, never `/events`.** `events` reads the history and accepts no write; closing a plan
   * is a route of its own because it is not "insert a row" — `MaintenanceCompletion` freezes the reading
   * the next interval counts from, and writes the checklist entry in the same transaction. Posting to
   * `/events` answered 405, so every "Record it" press was lost in silence.
   */
  complete: (assetId: string, payload: CompleteMaintenanceRequest) =>
    http.post<MaintenanceEvent>(`/monitoring/assets/${assetId}/maintenance/complete`, payload),
}

// ── Inspections ──────────────────────────────────────────────────────────────

export type InspectionOutcome = "PASSED" | "PASSED_WITH_REMARKS" | "FAILED"

export interface AssetInspection {
  id: string
  entryId: string
  formId: string | null
  formName: string | null
  planId: string | null
  outcome: InspectionOutcome
  performedAt: string
  performedBy: string | null
  note: string | null
}

/**
 * ⚠️ **There is no endpoint here that submits a form.** The checklist is filled in through
 * `/api/form-entries` like every other submission — which is what gives it validation, conditional
 * questions and photographs for free — and its identifier is tied to the asset afterwards.
 */
/**
 * One check, and what it was carried out on.
 *
 * ⚠️ **The inspection is nested, for `MaintenanceBoardEntry`'s reason** — the drawer already reads
 * `AssetInspection`, and flattening it here would give one fact two shapes.
 */
export interface InspectionBoardEntry {
  assetId: string
  assetLabel: string
  inspection: AssetInspection
}

export const inspectionsApi = {
  list: (assetId: string) => http.get<AssetInspection[]>(`/monitoring/assets/${assetId}/inspections`),

  /**
   * Every check in the workspace, most recent first.
   *
   * ⚠️ **Paged, unlike the per-asset list.** One thing's checks are a drawer's worth; a workspace's are a
   * log that only grows, and asking for all of them would slow down in proportion to how long somebody
   * had been using the product properly.
   */
  board: (parameters: { outcome?: InspectionOutcome; formId?: string; page?: number; size?: number } = {}) =>
    http.get<Page<InspectionBoardEntry>>("/monitoring/inspections", { params: parameters }),

  checklists: (assetId: string) =>
    http.get<Array<{ id: string; name: string; icon: string | null }>>(
      `/monitoring/assets/${assetId}/inspections/forms`,
    ),

  record: (
    assetId: string,
    payload: { entryId: string; planId?: string | null; outcome: InspectionOutcome; note?: string | null },
  ) => http.post<AssetInspection>(`/monitoring/assets/${assetId}/inspections`, payload),

  reviseOutcome: (assetId: string, inspectionId: string, payload: { outcome: InspectionOutcome; note?: string | null }) =>
    http.put<AssetInspection>(`/monitoring/assets/${assetId}/inspections/${inspectionId}/outcome`, payload),
}
