import { http } from "./http"
import type { Page } from "./forms"

/**
 * The system audit log.
 *
 * ⚠️ **Deliberately not under `/admin`** — the routes are gated on the `audit:read` permission and on
 * nothing else, so being able to manage users is not the same as being able to read everything everyone
 * has done.
 *
 * ⚠️ **No workspace header is sent.** This is the one screen in the product that ignores the active
 * workspace: authentication, user administration and scheduled work belong to no scope at all, and
 * scoping the read would hide exactly the events it exists for.
 */

export type AuditActorType = "USER" | "AGENT" | "IMPERSONATION" | "ANONYMOUS" | "SYSTEM"

export type AuditOutcome = "CARRIED_OUT" | "PREVIEWED" | "REFUSED" | "FAILED" | "DUPLICATE_SUPPRESSED"

export interface AuditEventView {
  id: string
  operationId: string
  occurredAt: string
  actorType: AuditActorType
  actorId: string | null
  actorName: string | null
  onBehalfOfId: string | null
  onBehalfOfName: string | null
  module: string
  action: string
  qualifiedAction: string
  outcome: AuditOutcome
  refusalReason: string | null
  destructive: boolean
  targetType: string | null
  targetId: string | null
  targetLabel: string | null
  affectedCount: number
  scopeType: string | null
  scopeId: string | null
  scopeLabel: string | null
}

export interface AuditTargetView {
  targetType: string
  targetId: string | null
  targetLabel: string | null
  primary: boolean
}

export interface AuditMetaView {
  key: string
  valueType: string
  value: string | null
}

export interface AuditOriginView {
  ipAddress: string | null
  userAgent: string | null
  countryCode: string | null
  region: string | null
  city: string | null
}

export interface AuditEventDetailView {
  event: AuditEventView
  targets: AuditTargetView[]
  meta: AuditMetaView[]
  origin: AuditOriginView | null
  relatedEvents: AuditEventView[]
}

export interface AuditActionOption {
  qualifiedName: string
  action: string
  destructive: boolean
  readSensitive: boolean
}

export interface AuditModuleOption {
  module: string
  actions: AuditActionOption[]
}

/**
 * Facet options declared by the backend registry — complete before any matching event exists.
 *
 * @property silentModules modules that deliberately record nothing — expression evaluation, search,
 *           pricing lookups, developer tooling. Listed so their absence from the log reads as a
 *           decision rather than as a recording path somebody forgot to write, which is otherwise the
 *           same thing to look at.
 */
export interface AuditCatalogView {
  modules: AuditModuleOption[]
  outcomes: AuditOutcome[]
  actorTypes: AuditActorType[]
  targetTypes: string[]
  silentModules: string[]
}

export interface AuditActorOption {
  id: string
  name: string | null
  actorType: AuditActorType
}

export interface AuditScopeOption {
  type: string
  id: string
  label: string | null
}

export type AuditMetaComparison = "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "GREATER_THAN" | "LESS_THAN"

/** One condition on a recorded detail — `entry.formName is "Resistors"`. */
export interface AuditMetaFilter {
  key: string
  comparison: AuditMetaComparison
  value: string
}

export type AuditMetaKeySource = "DECLARED" | "OBSERVED" | "BOTH"

export type AuditMetaValueType = "TEXT" | "NUMBER" | "BOOLEAN" | "TIMESTAMP"

export interface AuditMetaKeyView {
  key: string
  module: string
  source: AuditMetaKeySource
  valueType: AuditMetaValueType
  eventCount: number
  /** The distinct values, when few enough to offer as a choice. Empty when `freeText`. */
  values: string[]
  freeText: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export interface AuditMetaCatalogView {
  keys: AuditMetaKeyView[]
  lastScannedAt: string | null
  maximumFilters: number
  /** Why the limit is what it is — stated by the server so the screen explains rather than blocks. */
  limitExplanation: string
}

export interface AuditEventFilters {
  modules: string[]
  actions: string[]
  outcomes: string[]
  actors: string[]
  actorTypes: string[]
  targetTypes: string[]
  scopes: string[]
  from: string | null
  to: string | null
  /** Conditions on module-specific detail, combined with AND. Capped by the backend. */
  meta: AuditMetaFilter[]
}

export interface MyActivityFilters {
  modules: string[]
  actorTypes: string[]
  actors: string[]
  from: string | null
  to: string | null
}

/** What one record held immediately before it stopped holding it. */
export interface PreviousState {
  id: string
  label: string
  values: Record<string, string>
}

export interface MyActivityDetailView extends AuditEventDetailView {
  previousState: PreviousState[]
}

/** ⚠️ Axios repeats a key per value by default (`modules[]=a`); Spring wants `modules=a&modules=b`. */
const REPEATED_KEYS = { indexes: null } as const

export const auditApi = {
  listEvents: (filters: AuditEventFilters, page = 0, size = 50) =>
    http.get<Page<AuditEventView>>("/audit/events", {
      params: {
        modules: nonEmpty(filters.modules),
        actions: nonEmpty(filters.actions),
        outcomes: nonEmpty(filters.outcomes),
        actors: nonEmpty(filters.actors),
        actorTypes: nonEmpty(filters.actorTypes),
        targetTypes: nonEmpty(filters.targetTypes),
        scopes: nonEmpty(filters.scopes),
        meta: nonEmpty(filters.meta.map(encodeMetaFilter)),
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        page,
        size,
      },
      paramsSerializer: REPEATED_KEYS,
    }),

  getEvent: (eventId: string) => http.get<AuditEventDetailView>(`/audit/events/${eventId}`),

  getCatalog: () => http.get<AuditCatalogView>("/audit/catalog"),

  listActors: () => http.get<AuditActorOption[]>("/audit/actors"),

  listScopes: () => http.get<AuditScopeOption[]>("/audit/scopes"),

  getMetaKeys: () => http.get<AuditMetaCatalogView>("/audit/meta-keys"),

  /** Rebuilds the catalogue from scratch — a write, and the one expensive thing on this screen. */
  scanMetaKeys: () => http.post<AuditMetaCatalogView>("/audit/meta-keys/scan"),
}

/**
 * Your own history, out of the same store.
 *
 * ⚠️ **Two routes rather than a flag on the ones above**, because they answer to different things: those
 * are gated on `audit:read`, these on being the person asking. Nothing here says whose history to fetch
 * — the server reads that off the token, so no parameter reaches anybody else's.
 *
 * The detail route is the only one in the product that serves what a destroyed record used to hold, and
 * it serves it only to the account it belonged to.
 */
export const myActivityApi = {
  listEvents: (filters: MyActivityFilters, page = 0, size = 25) =>
    http.get<Page<AuditEventView>>("/audit/my-activity", {
      params: {
        modules: nonEmpty(filters.modules),
        actorTypes: nonEmpty(filters.actorTypes),
        actors: nonEmpty(filters.actors),
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        page,
        size,
      },
      paramsSerializer: REPEATED_KEYS,
    }),

  getEvent: (eventId: string) => http.get<MyActivityDetailView>(`/audit/my-activity/${eventId}`),
}

/** An empty facet is omitted entirely rather than sent as an empty list that would narrow to nothing. */
function nonEmpty(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined
}

/**
 * `key:comparison:value`, which the backend splits on the first two separators so a value may contain
 * them. One delimited parameter rather than three parallel lists, because parallel lists can arrive
 * misaligned and quietly answer a different question than the one asked.
 */
function encodeMetaFilter(filter: AuditMetaFilter): string {
  return `${filter.key}:${filter.comparison}:${filter.value}`
}
