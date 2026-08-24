import type { ReactNode } from "react"
import { Badge, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton } from "@jmouse/ui"
import { auditScopeKind, describeActorInline } from "@/lib/auditEvent"
import { useAuditEvent, useMyActivityEvent } from "@/hooks/useAudit"
import type { AuditEventDetailView, AuditEventView, AuditOriginView, MyActivityDetailView } from "@/api/audit"

/**
 * Everything one event touched, knew and came from.
 *
 * A drawer rather than a page, so the table and the filters stay on screen — somebody working through a
 * list of events one by one should never lose their place to look at one of them.
 *
 * ⚠️ **One drawer for both readers, and the reader is what decides how much of the event there is to
 * read.** On the system-wide log, **previous state is not here and is not fetched**: the contents of
 * destroyed records are the user's own data, and the service behind that screen holds no reference to
 * the repository that stores them, so there is nothing for this component to ask for. In an account's
 * own activity there is, and it is shown in full.
 *
 * @param reader whose view this is — `system` for the audit log, `owner` for somebody reading their own
 *               history. It picks the endpoint, and the endpoint is where the difference lives.
 */
export function AuditEventDrawer({
  eventId,
  onClose,
  reader = "system",
}: {
  eventId: string
  onClose: () => void
  reader?: "system" | "owner"
}) {
  const systemDetail = useAuditEvent(reader === "system" ? eventId : null)
  const ownDetail = useMyActivityEvent(reader === "owner" ? eventId : null)

  // Annotated rather than inferred, so the two readers meet as one type at this line and the rest of
  // the component never asks which of them it is rendering.
  const detail: { isLoading: boolean; data?: AuditEventDetailView | MyActivityDetailView } =
    reader === "owner" ? ownDetail : systemDetail

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Event</SheetTitle>
          <SheetDescription>Everything this one operation touched, knew and came from.</SheetDescription>
        </SheetHeader>

        {detail.isLoading || !detail.data ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Section title="What happened">
              <Fact label="Action" value={detail.data.event.qualifiedAction} mono />
              <Fact label="Outcome" value={detail.data.event.outcome} mono />
              {detail.data.event.refusalReason && <Fact label="Reason" value={detail.data.event.refusalReason} mono />}
              <Fact label="When" value={new Date(detail.data.event.occurredAt).toLocaleString()} />
              <Fact label="Actor" value={describeActorInline(detail.data.event)} />
              <Fact label="Affected" value={String(detail.data.event.affectedCount)} mono />
              {detail.data.event.scopeLabel && <Fact label="Scope" value={describeScope(detail.data.event)} />}
            </Section>

            <Section title={`Objects (${detail.data.targets.length})`}>
              {detail.data.targets.length === 0 ? (
                <p className="text-xs text-muted-foreground">This event was not about a particular object.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {detail.data.targets.map((target) => (
                    <li
                      key={`${target.targetType}:${target.targetId}`}
                      className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                    >
                      <span className="truncate">{target.targetLabel ?? target.targetId}</span>
                      <span className="text-[11px] text-muted-foreground">{target.targetType}</span>
                      {target.primary && (
                        <Badge variant="secondary" className="ml-auto">
                          primary
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Details">
              {detail.data.meta.length === 0 ? (
                <p className="text-xs text-muted-foreground">This module recorded no detail for this action.</p>
              ) : (
                detail.data.meta.map((meta) => <Fact key={meta.key} label={meta.key} value={meta.value ?? "—"} mono />)
              )}
            </Section>

            <Section title="Where it came from">
              {!detail.data.origin ? (
                <p className="text-xs text-muted-foreground">No request context — this did not come from a browser.</p>
              ) : (
                <OriginFacts origin={detail.data.origin} />
              )}
            </Section>

            <PreviousStateSection detail={detail.data} />

            {detail.data.relatedEvents.length > 0 && (
              <Section title={`Same operation (${detail.data.relatedEvents.length})`}>
                <ul className="flex flex-col gap-1">
                  {detail.data.relatedEvents.map((related) => (
                    <li key={related.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                      <span className="truncate font-mono">{related.qualifiedAction}</span>
                      <span className="text-[11px] text-muted-foreground">{related.outcome}</span>
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                        {new Date(related.occurredAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * What the records this event destroyed used to hold.
 *
 * ⚠️ **Absent rather than empty on the system-wide log**, where the response has no such field at all —
 * an empty "What it was beforehand" would read as "nothing was in them", which is a different and false
 * statement.
 *
 * Rendered in full rather than summarised. There is no undo anywhere in this product, so recovering a
 * record by hand means reading these values and typing them back, and a summary would not let anybody.
 */
function PreviousStateSection({ detail }: { detail: AuditEventDetailView | MyActivityDetailView }) {
  const previousState = "previousState" in detail ? detail.previousState : []

  if (previousState.length === 0) {
    return null
  }

  return (
    <Section title="What it was beforehand">
      {previousState.map((record) => (
        <div key={record.id} className="flex flex-col gap-1 rounded-md border p-2">
          <div className="text-xs font-medium">{record.label}</div>
          <div className="flex flex-col gap-0.5">
            {Object.entries(record.values).map(([field, value]) => (
              <div key={field} className="flex gap-2 text-[11px]">
                <span className="w-32 shrink-0 text-muted-foreground">{field}</span>
                <span className="min-w-0 break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold tracking-[0.04em] uppercase">{title}</h4>
      {children}
    </section>
  )
}

/**
 * The scope's name, and its kind when the kind is a surprise.
 *
 * Every scope is a space today, so this reads as a bare name; a scope that is something else says so
 * rather than passing for one.
 */
function describeScope(event: AuditEventView): string {
  const kind = auditScopeKind(event.scopeType)

  return kind === null ? event.scopeLabel! : `${event.scopeLabel} (${kind})`
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "min-w-0 font-mono break-words" : "min-w-0 break-words"}>{value}</span>
    </div>
  )
}

/**
 * Where the request came from.
 *
 * The location line is absent rather than empty when nothing resolved it — the shipped geolocation
 * provider is `none`, so that is the normal case and a blank "Location: —" would read as a failed lookup
 * rather than as one nobody asked for.
 */
function OriginFacts({ origin }: { origin: AuditOriginView }) {
  const location = [origin.city, origin.region, origin.countryCode].filter(Boolean).join(", ")

  return (
    <>
      <Fact label="IP address" value={origin.ipAddress ?? "—"} mono />
      <Fact label="User agent" value={origin.userAgent ?? "—"} />
      {location && <Fact label="Location" value={location} />}
    </>
  )
}
