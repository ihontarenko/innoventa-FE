import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Button, Skeleton } from "@jmouse/ui"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useMyActivity } from "@/hooks/useAudit"
import { AuditEventDrawer } from "@/pages/audit/AuditEventDrawer"
import { AuditEventTable } from "@/pages/audit/AuditEventTable"
import type { MyActivityFilters } from "@/api/audit"

const PAGE_SIZE = 25

/** The module every sign-in, sign-out and two-factor attempt is recorded under. */
const AUTHENTICATION = "authentication"

type ActivityKind = "all" | "signIns" | "agents" | "impersonation"

/**
 * Which slice of your own history you are looking at.
 *
 * Four questions people actually ask, rather than the whole facet panel the audit log offers: this is
 * somebody checking on their own account, not somebody investigating an installation.
 */
const KIND_NARROWINGS: Record<ActivityKind, { modules: string[]; actorTypes: string[] }> = {
  all: { modules: [], actorTypes: [] },
  signIns: { modules: [AUTHENTICATION], actorTypes: [] },
  agents: { modules: [], actorTypes: ["AGENT"] },
  impersonation: { modules: [], actorTypes: ["IMPERSONATION"] },
}

const KIND_SEGMENTS = [
  { value: "all" as const, label: "Everything" },
  { value: "signIns" as const, label: "Sign-ins" },
  { value: "agents" as const, label: "My agents" },
  { value: "impersonation" as const, label: "Entered as me" },
]

const KIND_EMPTINESS: Record<ActivityKind, string> = {
  all: "Nothing has been recorded under your account yet.",
  signIns: "No sign-in attempts recorded yet.",
  agents:
    "None of your agents has changed anything. Reading your data is not a change, so an agent that has only been answering questions leaves nothing here.",
  impersonation:
    "Nobody has entered your account. If an administrator ever does, both the session and everything done inside it appear here.",
}

/**
 * Your own history: your sign-ins, what your agents changed, and any session an administrator ran inside
 * your account.
 *
 * The same store and the same table the system-wide audit log uses, narrowed by the server to the events
 * under your authority — not a second implementation, and not a screen anybody needs `audit:read` to
 * open. It is your history.
 *
 * ⚠️ It is also the one place in the product where the contents of destroyed records can be read, and
 * only by the account they belonged to. The drawer opens them here and asks for them nowhere else.
 */
export function MyActivityTab() {
  const [searchParameters, setSearchParameters] = useSearchParams()

  /** Arrived from an agent's row on the Agents tab: same history, narrowed to that agent. */
  const narrowedAgentId = searchParameters.get("agent")

  const [kind, setKind] = useState<ActivityKind>(narrowedAgentId ? "agents" : "all")
  const [page, setPage] = useState(0)
  const [openEventId, setOpenEventId] = useState<string | null>(null)

  const filters = useMemo<MyActivityFilters>(
    () => ({
      ...KIND_NARROWINGS[kind],
      actors: narrowedAgentId ? [narrowedAgentId] : [],
      from: null,
      to: null,
    }),
    [kind, narrowedAgentId],
  )

  const eventsPage = useMyActivity(filters, page, PAGE_SIZE)
  const events = eventsPage.data?.content ?? []

  // Read off the rows rather than fetched: the agent list needs a permission this screen deliberately
  // does not, and the events already name whoever acted.
  const narrowedAgentName = events.find((event) => event.actorId === narrowedAgentId)?.actorName

  /**
   * Any change of question starts at the first page — page 7 of the old answer means nothing.
   *
   * Leaving the agents tab also drops the narrowing to one agent, which would otherwise survive into
   * "Sign-ins" and answer, quite correctly and quite uselessly, that an agent has never signed in.
   */
  function chooseKind(next: ActivityKind) {
    setKind(next)
    setPage(0)

    if (next !== "agents") {
      setSearchParameters({})
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">My activity</h2>
        <p className="text-xs text-muted-foreground">
          Everything recorded under your account — what you did, what your agents did for you, and any session an
          administrator ran as you. Only changes are recorded; reading your own data leaves nothing here.
        </p>
      </div>

      <SegmentedControl ariaLabel="Which slice of your history" segments={KIND_SEGMENTS} value={kind} onChange={chooseKind} />

      {narrowedAgentId && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
          <span>
            Narrowed to <strong>{narrowedAgentName ?? "one agent"}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setSearchParameters({})
              setPage(0)
            }}
          >
            Show all
          </Button>
        </div>
      )}

      {eventsPage.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
          <span className="text-sm font-medium">Nothing here</span>
          <span className="max-w-lg text-xs text-muted-foreground">{KIND_EMPTINESS[kind]}</span>
        </div>
      ) : (
        eventsPage.data && (
          <AuditEventTable events={eventsPage.data} page={page} onPageChange={setPage} onOpen={setOpenEventId} />
        )
      )}

      {openEventId && <AuditEventDrawer eventId={openEventId} reader="owner" onClose={() => setOpenEventId(null)} />}

      <p className="text-[11px] text-muted-foreground">
        Open any row to see what was touched, where the request came from, and — for anything that was deleted — what it
        held beforehand. Those values are shown to you and to nobody else: the installation-wide audit log cannot reach
        them at all.
      </p>
    </div>
  )
}
