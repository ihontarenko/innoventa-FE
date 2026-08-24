import { useMemo, useState } from "react"
import { Badge, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@jmouse/ui"
import type { PermissionDetailView, PermissionSourceView, PlaceStandingView } from "@/api/access"
import type { PolicyOverrideSeed } from "@/api/policy"
import { useAccessWho } from "@/hooks/useAccess"
import { useAdminUsers } from "@/hooks/useAdministration"
import { useSpaces } from "@/hooks/useSpaces"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { SourceLine } from "./SourceLine"

/**
 * A person, optionally a workspace, and every permission they effectively hold.
 *
 * ⚠️ **The scope selector is not a filter — it is part of the question.** The same person legitimately
 * holds different sets in two workspaces, and a screen that answered without naming where would be
 * answering a question nobody asked.
 *
 * ⚠️ **`onOverride` is absent where there is no document to write into.** It composes a `deny` rather
 * than deleting the grant, and it does not apply it — see the note on the button in `SourceLine`.
 */
export function WhoPanel({ onOverride }: { onOverride?: (seed: PolicyOverrideSeed) => void }) {
  const [search, setSearch] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [spaceId, setSpaceId] = useState("")

  const debouncedSearch = useDebouncedValue(search, 250)
  const { data: users } = useAdminUsers(debouncedSearch || undefined, 0, 25)
  const { data: spaces } = useSpaces()
  const { data, isLoading } = useAccessWho(userId ?? undefined, { spaceId: spaceId || undefined })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-56"
          placeholder="Name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Person"
          className="h-9 min-w-56 rounded-md border bg-transparent px-2 text-sm shadow-xs"
          value={userId ?? ""}
          onChange={(event) => setUserId(event.target.value || null)}
        >
          <option value="">Pick a person…</option>
          {users?.content?.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName || person.email}
            </option>
          ))}
        </select>

        <select
          aria-label="Where"
          className="h-9 min-w-48 rounded-md border bg-transparent px-2 text-sm shadow-xs"
          value={spaceId}
          onChange={(event) => setSpaceId(event.target.value)}
        >
          <option value="">Installation-wide</option>
          {spaces?.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      {!userId ? (
        <EmptyAnswer
          glyph="◎"
          title="Pick somebody"
          message="This answers what one person may actually do, and why — not what a role says."
        />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data ? null : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
            <span className="font-medium">{data.subject.displayName || data.subject.email}</span>
            {data.subject.serviceAccount && <Badge variant="secondary">agent of {data.subject.agentOf}</Badge>}
            {/* ⚠️ "Not a member" and "a member with nothing granted" are two different refusals with two
                different next moves, so they are two different badges. */}
            <Badge variant={data.subject.reachesHere ? "default" : "outline"}>
              {data.subject.reachesHere ? `reaches ${data.scope.label}` : `nothing reaches ${data.scope.label}`}
            </Badge>
          </div>

          <PlaceStandings standings={data.axes} />

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">
              Permissions at {data.scope.label}
            </h3>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Permission</TableHead>
                    <TableHead className="w-28">Held</TableHead>
                    <TableHead>How</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.permissions.map((detail) => (
                    <PermissionRow
                      key={detail.permission}
                      detail={detail}
                      onOverride={
                        onOverride &&
                        ((permission, source) =>
                          onOverride({
                            subjectId: userId,
                            permission,
                            // ⚠️ Where the RULE reaches, not where the question was asked. Overriding a
                            // grant that came from the installation with a deny confined to one
                            // workspace leaves it in force everywhere else — and the reader would have
                            // watched the deny appear and the permission stay.
                            scope: source.scope?.type ?? data.scope.type,
                            instance: source.scope?.id ?? data.scope.id ?? null,
                          }))
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/**
 * One permission and every route that decided it.
 *
 * ⚠️ **A deny is rendered as the thing that REMOVED it, not as an absence.** That is the whole point of
 * deny running last: somebody has to be able to find out why a power vanished, and a permission simply
 * missing from a list cannot tell them.
 */
function PermissionRow({
  detail,
  onOverride,
}: {
  detail: PermissionDetailView
  onOverride?: (permission: string, source: PermissionSourceView) => void
}) {
  return (
    <TableRow className={cn(!detail.held && "opacity-70")}>
      <TableCell className="font-mono text-xs">{detail.permission}</TableCell>
      <TableCell>
        <Badge variant={detail.held ? "default" : "outline"}>
          {detail.held ? "✓" : detail.removedBy.length > 0 ? "✗ removed" : "—"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {detail.grantedBy.map((source, index) => (
            <SourceLine
              key={`granted-${index}`}
              source={source}
              removed={false}
              // ⚠️ Only on a line that GRANTS. A "removed by" line is already a denial, and offering to
              // deny a deny is a button whose effect is nothing.
              onOverride={onOverride && (() => onOverride(detail.permission, source))}
            />
          ))}
          {detail.removedBy.map((source, index) => (
            <SourceLine key={`removed-${index}`} source={source} removed />
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * ⚠️ **Each axis in its own words.** Sharing one sentence between two of them is the mistake this whole
 * subsystem is built to avoid: told "switched off here" about a module their workspace could never
 * carry, a reader goes looking for a switch that does not exist.
 */
const BLOCKED_BECAUSE: Record<NonNullable<PlaceStandingView["blocks"]>, string> = {
  CEILING: "workspaces of this kind never have this",
  ENTITLEMENT: "not included in the plan",
  MODULE_SWITCH: "switched off here",
}

/**
 * The axes that are about the *place*, shown beside the permissions.
 *
 * A permission held but unusable because the module is switched off reads as held-and-blocked rather
 * than as missing. They are two different conversations with two different people.
 */
function PlaceStandings({ standings }: { standings: PlaceStandingView[] }) {
  const blocked = useMemo(() => standings.filter((standing) => standing.blocks), [standings])

  if (blocked.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">
        Blocked before the permission is even asked
      </h3>
      <div className="flex flex-wrap gap-2">
        {blocked.map((standing) => (
          <span key={standing.moduleKey} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
            <span className="font-medium">{standing.moduleName}</span>
            <Badge variant="outline">{BLOCKED_BECAUSE[standing.blocks!]}</Badge>
          </span>
        ))}
      </div>
    </section>
  )
}

export function EmptyAnswer({ glyph, title, message }: { glyph: string; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        {glyph}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{message}</span>
    </div>
  )
}
