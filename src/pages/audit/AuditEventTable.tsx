import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import { Pagination } from "@/components/Pagination"
import { auditScopeKind, describeActor, humanizeAuditValue, outcomeVariant } from "@/lib/auditEvent"
import type { AuditEventView } from "@/api/audit"
import type { Page } from "@/api/forms"

/**
 * A page of recorded events.
 *
 * **One implementation for both readers**: the system-wide log, and an account reading its own history.
 * What separates them is which endpoint filled the page, not how a row looks — an event that reads one
 * way to an administrator and another way to the person it happened to would be the one difference
 * nobody could account for.
 *
 * Deliberately without IP, user agent, geolocation or meta. Those are what the drawer is for, and a
 * table carrying them is one nobody can scan.
 */
export function AuditEventTable({
  events,
  onOpen,
  page,
  onPageChange,
}: {
  events: Page<AuditEventView>
  onOpen: (eventId: string) => void
  page: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Time</TableHead>
              <TableHead className="w-52">Actor</TableHead>
              <TableHead className="w-64">Action</TableHead>
              <TableHead>Object</TableHead>
              <TableHead className="w-40">Scope</TableHead>
              <TableHead className="w-44">Outcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.content.map((event) => (
              <EventRow key={event.id} event={event} onOpen={() => onOpen(event.id)} />
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={events.totalPages}
        totalElements={events.totalElements}
        size={events.size}
        onChange={onPageChange}
      />
    </div>
  )
}

function EventRow({ event, onOpen }: { event: AuditEventView; onOpen: () => void }) {
  const occurred = new Date(event.occurredAt)

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="align-top font-mono text-xs">
        <div>{occurred.toLocaleDateString()}</div>
        <div className="text-muted-foreground">
          {occurred.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </TableCell>

      <TableCell className="align-top">
        <ActorCell event={event} />
      </TableCell>

      <TableCell className="align-top">
        <span className="font-mono text-xs">{event.qualifiedAction}</span>
        {event.destructive && (
          <span className="ml-1 text-destructive" title="Destructive">
            ✕
          </span>
        )}
      </TableCell>

      <TableCell className="align-top">
        <ObjectCell event={event} />
      </TableCell>

      <TableCell className="align-top">
        <ScopeCell event={event} />
      </TableCell>

      <TableCell className="align-top">
        <Badge variant={outcomeVariant(event.outcome)} className="font-mono text-[11px]">
          {humanizeAuditValue(event.outcome)}
        </Badge>
        {event.refusalReason && (
          <div className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground" title={event.refusalReason}>
            {event.refusalReason}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * What the event happened inside of — a dash where it happened inside nothing, which is most rows.
 *
 * The kind is named only when it is not a space. Today it never is, so this reads exactly as it did; the
 * day it is, the column will not have been quietly wrong in the meantime.
 */
function ScopeCell({ event }: { event: AuditEventView }) {
  if (!event.scopeLabel) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const kind = auditScopeKind(event.scopeType)

  return (
    <div className="text-xs">
      <div>{event.scopeLabel}</div>
      {kind && <div className="text-[11px] text-muted-foreground">{kind}</div>}
    </div>
  )
}

/**
 * Who acted, and whose authority was in play — laid out over two lines so the borrowed identity never
 * carries the same weight as the actor.
 */
function ActorCell({ event }: { event: AuditEventView }) {
  const description = describeActor(event)

  if (description.actor === null) {
    return <span className="text-xs text-muted-foreground">Anonymous</span>
  }

  return (
    <div className="flex flex-col text-xs">
      <span>{description.actor}</span>
      {description.onBehalfOf && (
        <span className="text-[11px] text-muted-foreground">
          {description.relation} {description.onBehalfOf}
        </span>
      )}
    </div>
  )
}

/** The primary object, plus how many others the same operation touched. */
function ObjectCell({ event }: { event: AuditEventView }) {
  if (!event.targetLabel && !event.targetId) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const others = event.affectedCount - 1

  return (
    <div className="flex flex-col text-xs">
      <span className="truncate">{event.targetLabel ?? event.targetId}</span>
      <span className="text-[11px] text-muted-foreground">
        {event.targetType}
        {others > 0 && ` · +${others} more`}
      </span>
    </div>
  )
}
