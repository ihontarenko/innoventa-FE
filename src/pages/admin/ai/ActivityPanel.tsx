import { useState } from "react"
import { Badge, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { useToolCalls, useUsageTotals } from "@/hooks/useAiAdministration"

/**
 * What has been called, and how much of it.
 *
 * Two tables answering one question at two grains: the trail says *what just happened*, the totals say
 * *what keeps happening*. Both keep the outcome in view rather than summing it away — a caller whose
 * calls are ninety per cent refusals is the single most useful thing either table says, and a total by
 * caller alone would hide exactly that.
 *
 * ⚠️ **An empty trail is two different facts.** Nothing has been called, or nothing records what is
 * called — identical here and opposite in meaning, so the overview asks the server which it is and this
 * panel says so rather than leaving somebody to assume the reassuring one.
 */
export function ActivityPanel({ trailRecorded }: { trailRecorded: boolean }) {
  const [caller, setCaller] = useState("")
  const calls = useToolCalls({ caller: caller || undefined, limit: 100 })
  const totals = useUsageTotals()

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Recent calls</h2>
          <Input
            className="ml-auto h-8 w-64 text-sm"
            value={caller}
            placeholder="Narrow to one caller…"
            onChange={(event) => setCaller(event.target.value)}
          />
        </div>

        {!trailRecorded ? (
          <Callout tone="info">
            <span>
              <strong>Nothing records a trail on this installation.</strong> That is not the same as nothing having been
              called — the list below would be empty either way, so it is said here rather than left to be assumed.
            </span>
          </Callout>
        ) : calls.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (calls.data ?? []).length === 0 ? (
          <EmptyPane title="Nothing has been called yet" message="A trail is being recorded — there is simply nothing in it." />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="w-36">Outcome</TableHead>
                  <TableHead className="w-20">Records</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(calls.data ?? []).map((call) => (
                  <TableRow key={call.operationId}>
                    <TableCell className="text-xs">{new Date(call.at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{call.qualifiedName}</TableCell>
                    <TableCell className="text-xs">
                      {call.callerId}
                      {/* An agent acting for somebody is two identities, and which one a refusal was
                          measured against is the whole question when somebody asks why a call failed. */}
                      {call.actingSubject !== call.callerId && (
                        <div className="text-[11px] text-muted-foreground">for {call.actingSubject}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{call.scopeLabel ?? "—"}</TableCell>
                    <TableCell>
                      <Outcome outcome={call.outcome} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{call.affectedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Totals</h2>
          <span className="text-xs text-muted-foreground">by caller, action and outcome</span>
        </div>

        {(totals.data ?? []).length === 0 ? (
          <EmptyPane title="Nothing counted yet" message="Totals appear as soon as anything is called." />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-36">Outcome</TableHead>
                  <TableHead className="w-20">Calls</TableHead>
                  <TableHead className="w-24">Tokens</TableHead>
                  <TableHead className="w-44">Last</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(totals.data ?? []).map((total) => (
                  <TableRow key={`${total.callerId}-${total.qualifiedName}-${total.outcome}`}>
                    <TableCell className="text-xs">{total.callerId}</TableCell>
                    <TableCell className="font-mono text-xs">{total.qualifiedName}</TableCell>
                    <TableCell>
                      <Outcome outcome={total.outcome} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{total.calls}</TableCell>
                    <TableCell className="font-mono text-xs">{total.tokens > 0 ? total.tokens : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(total.lastCalledAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyPane({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-8 text-center">
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{message}</span>
    </div>
  )
}

/**
 * The verdict or the refusal reason, as a badge.
 *
 * Two colours and not three: a call either did what it was asked or it did not, and inventing a middle
 * shade for previews and suppressed duplicates would give somebody a colour to learn rather than a word
 * to read.
 */
function Outcome({ outcome }: { outcome: string }) {
  const succeeded = outcome === "SUCCEEDED" || outcome === "PREVIEWED" || outcome === "SUPPRESSED"

  return <Badge variant={succeeded ? "secondary" : "destructive"}>{outcome.toLowerCase().replace(/_/g, " ")}</Badge>
}
