import { useMemo, useState } from "react"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import {
  useAuditActors,
  useAuditCatalog,
  useAuditEvents,
  useAuditMetaKeys,
  useAuditScopes,
  useScanAuditMetaKeys,
} from "@/hooks/useAudit"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const AUDIT_LOG = platformItem("audit-log")
import { humanizeAuditValue } from "@/lib/auditEvent"
import type { AuditEventFilters, AuditMetaFilter } from "@/api/audit"
import { AuditEventDrawer } from "./AuditEventDrawer"
import { AuditEventTable } from "./AuditEventTable"
import { AuditMetaFilters } from "./AuditMetaFilters"

const PAGE_SIZE = 50

const EMPTY_FILTERS: AuditEventFilters = {
  modules: [],
  actions: [],
  outcomes: [],
  actors: [],
  actorTypes: [],
  targetTypes: [],
  scopes: [],
  from: null,
  to: null,
  meta: [],
}

/** Events that belong to nothing enclosing — authentication, administration, scheduled work. */
const NO_SCOPE = "none"

/** The facets that are plain string lists on the filter object — everything but the dates and the meta. */
type FacetKey = "modules" | "actions" | "outcomes" | "actors" | "actorTypes" | "targetTypes" | "scopes"

interface FacetSection {
  key: FacetKey
  title: string
  options: { value: string; label: string; hint?: string }[]
}

/**
 * The system audit log: one screen for everything that has happened across the installation.
 *
 * Its own main-menu item rather than a tab inside user management, and gated on `audit:read` rather than
 * on the admin role — being able to manage users is deliberately not the same as being able to read
 * everything everyone has done.
 *
 * ⚠️ **Unlike almost every other screen this one ignores the active workspace.** Scope is a facet the
 * reader chooses, and events belonging to no scope at all — which is most of the security module — stay
 * reachable.
 */
export function AuditLogPage() {
  const mayOpen = useAuthStore((state) => state.holds)

  const [filters, setFilters] = useState<AuditEventFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [openEventId, setOpenEventId] = useState<string | null>(null)

  const catalog = useAuditCatalog()
  const actors = useAuditActors()
  const scopes = useAuditScopes()
  const metaKeys = useAuditMetaKeys()
  const scanMetaKeys = useScanAuditMetaKeys()

  /**
   * A detail filter reaches the query only once it has a value. A half-typed condition would narrow to
   * nothing on every keystroke, so the row is allowed to exist on screen before it means anything.
   */
  const activeMetaFilters = useMemo(
    () => filters.meta.filter((filter) => filter.value.trim().length > 0),
    [filters.meta],
  )

  const queryFilters = useMemo(() => ({ ...filters, meta: activeMetaFilters }), [filters, activeMetaFilters])

  const eventsPage = useAuditEvents(queryFilters, page, PAGE_SIZE)
  const events = eventsPage.data?.content ?? []

  const sections = useMemo<FacetSection[]>(() => {
    const modules = catalog.data?.modules ?? []

    return [
      { key: "modules", title: "Module", options: modules.map((module) => ({ value: module.module, label: module.module })) },
      {
        key: "actions",
        title: "Action",
        options: modules.flatMap((module) =>
          module.actions.map((action) => ({ value: action.qualifiedName, label: action.action, hint: module.module })),
        ),
      },
      {
        key: "outcomes",
        title: "Outcome",
        options: (catalog.data?.outcomes ?? []).map((outcome) => ({
          value: outcome,
          label: humanizeAuditValue(outcome),
        })),
      },
      {
        key: "actorTypes",
        title: "Actor type",
        options: (catalog.data?.actorTypes ?? []).map((actorType) => ({
          value: actorType,
          label: humanizeAuditValue(actorType),
        })),
      },
      {
        key: "actors",
        title: "Actor",
        options: (actors.data ?? []).map((actor) => ({
          value: actor.id,
          label: actor.name ?? actor.id,
          hint: actor.actorType === "USER" ? undefined : humanizeAuditValue(actor.actorType),
        })),
      },
      {
        key: "targetTypes",
        title: "Object type",
        options: (catalog.data?.targetTypes ?? []).map((targetType) => ({ value: targetType, label: targetType })),
      },
      {
        // ⚠️ "Scope", matching the API, this filter key and the hook. Not "Workspace": most events —
        // authentication, user administration, impersonation, retention purges — belong to no scope at
        // all, and a column headed Workspace that is empty on most rows reads as missing data rather
        // than as the truth.
        key: "scopes",
        title: "Scope",
        options: [
          { value: NO_SCOPE, label: "No scope" },
          ...(scopes.data ?? []).map((scope) => ({ value: scope.id, label: scope.label ?? scope.id })),
        ],
      },
    ]
  }, [catalog.data, actors.data, scopes.data])

  // ⚠️ Installation-wide on purpose: `audit:read` is meaningless below the installation, and the coarse
  // "holds it somewhere" answer would open this screen to anybody granted it in one workspace — which is
  // the whole log, from a permission scoped to one place. That is now said ONCE, on the declaration in
  // `navigation.ts`, and asked here — so the menu row and this refusal cannot come to different answers.
  if (!mayOpen(AUDIT_LOG)) {
    return (
      <AccessDenied
        title="Audit log"
        why="The audit log is everything that has happened across the installation, so it is read with a permission held over the installation rather than in one workspace."
        permissions={requiredPermissionsOf(AUDIT_LOG)}
      />
    )
  }

  /** Any filter change resets to the first page — page 7 of the old result set means nothing. */
  function applyFilters(next: AuditEventFilters) {
    setFilters(next)
    setPage(0)
  }

  function toggleFacet(facet: FacetKey, value: string) {
    const current = filters[facet]
    const selected = current.includes(value) ? current.filter((candidate) => candidate !== value) : [...current, value]

    applyFilters({ ...filters, [facet]: selected })
  }

  /**
   * ⚠️ The backend compares inclusively at both ends, so the upper bound has to be the end of the chosen
   * day — anchoring it at midnight would silently exclude everything that happened on the very day the
   * reader picked.
   */
  function changeDate(bound: "from" | "to", value: string) {
    if (!value) {
      applyFilters({ ...filters, [bound]: null })
      return
    }

    applyFilters({ ...filters, [bound]: `${value}${bound === "from" ? "T00:00:00" : "T23:59:59"}` })
  }

  function changeMetaFilters(meta: AuditMetaFilter[]) {
    setFilters({ ...filters, meta })
    setPage(0)
  }

  const selectedCount = sections.reduce((total, section) => total + filters[section.key].length, 0) + activeMetaFilters.length

  return (
    <>
      <PageHeader title="Audit log" description="Everything that has happened across the installation" />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* ⚠️ The bleed-and-repad that makes the divider meet the header above and the frame below —
            see `FilterPanel` for why, it is the same three classes on every split screen here. */}
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-[0.04em] uppercase">Filters</span>
            {selectedCount > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => applyFilters(EMPTY_FILTERS)}>
                Clear all
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">From</span>
              <Input
                className="h-8 text-xs"
                type="date"
                value={dateOnly(filters.from)}
                onChange={(event) => changeDate("from", event.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">To</span>
              <Input
                className="h-8 text-xs"
                type="date"
                value={dateOnly(filters.to)}
                onChange={(event) => changeDate("to", event.target.value)}
              />
            </label>
          </div>

          {sections.map((section) => (
            <FacetGroup
              key={section.key}
              section={section}
              selected={filters[section.key]}
              onToggle={(value) => toggleFacet(section.key, value)}
            />
          ))}

          <AuditMetaFilters
            catalogue={metaKeys.data}
            filters={filters.meta}
            onChange={changeMetaFilters}
            onScan={() => scanMetaKeys.mutate()}
            isScanning={scanMetaKeys.isPending}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="text-xs">
            <strong>{eventsPage.data?.totalElements ?? 0}</strong>
            <span className="text-muted-foreground"> events</span>
            {selectedCount > 0 && <span className="text-muted-foreground"> · {selectedCount} filters</span>}
          </div>

          {eventsPage.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span className="text-sm font-medium">Nothing here</span>
              <span className="max-w-lg text-xs text-muted-foreground">
                {selectedCount > 0
                  ? "No events match these filters. Every module and action is offered before it has happened, so this means nothing matched — not that you picked an unknown value."
                  : "Nothing has been recorded yet."}
              </span>
            </div>
          ) : (
            eventsPage.data && (
              <AuditEventTable events={eventsPage.data} page={page} onPageChange={setPage} onOpen={setOpenEventId} />
            )
          )}
        </div>
      </div>

      {openEventId && <AuditEventDrawer eventId={openEventId} onClose={() => setOpenEventId(null)} />}
    </>
  )
}

/**
 * One facet, collapsed to its chips.
 *
 * ⚠️ **Chosen values are always shown, however long the list is.** A facet that hides what is selected
 * behind a "show more" is one where somebody wonders why the table is empty.
 */
function FacetGroup({
  section,
  selected,
  onToggle,
}: {
  section: FacetSection
  selected: string[]
  onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (section.options.length === 0) {
    return null
  }

  const chosen = section.options.filter((option) => selected.includes(option.value))
  const rest = section.options.filter((option) => !selected.includes(option.value))
  const shown = expanded ? rest : rest.slice(0, 6)
  const hidden = rest.length - shown.length

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          {section.title}
        </span>
        {selected.length > 0 && <span className="text-[11px] text-muted-foreground">{selected.length}</span>}
      </div>

      <div className="flex flex-wrap gap-1">
        {[...chosen, ...shown].map((option) => (
          <ToggleChip
            key={option.value}
            active={selected.includes(option.value)}
            title={option.hint}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </ToggleChip>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:underline"
            onClick={() => setExpanded(true)}
          >
            +{hidden} more
          </button>
        )}
      </div>
    </section>
  )
}

/** The API speaks ISO date-times; the date input wants a bare date. */
function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : ""
}
