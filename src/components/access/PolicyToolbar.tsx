import { AlertTriangle, History, PlayCircle, Save } from "lucide-react"
import { Badge, Button, Input, cn } from "@jmouse/ui"
import type { PolicyWorkbench } from "@/hooks/usePolicyWorkbench"

/**
 * The version, the unsaved mark, and the two buttons that change the installation.
 *
 * ⚠️ **Rehearse and Save are two acts, and the order is not negotiable.** A dry run resolves the whole
 * document against every account and reports who would gain or lose — saving without reading that is
 * changing what other people may do while looking at a text editor.
 */
export function PolicyToolbar({ workbench }: { workbench: PolicyWorkbench }) {
  const { version, dirty, mayWrite, problems, rehearsing, rehearse } = workbench
  const blocking = problems.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <Badge variant="outline" className="font-mono">
        v{version}
      </Badge>

      <span className={cn("flex items-center gap-1.5 text-xs", dirty ? "text-foreground" : "text-muted-foreground")}>
        <span className={cn("size-1.5 rounded-full", dirty ? "bg-warning" : "bg-transparent")} />
        {dirty ? "unsaved" : "saved"}
      </span>

      {blocking && (
        <span className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          {problems.length} problem{problems.length === 1 ? "" : "s"}
        </span>
      )}

      {!mayWrite && (
        // ⚠️ Said rather than shown by disabled buttons alone: "nothing happens when I click" is a
        // worse answer than "you may read this and not change it".
        <Badge variant="secondary">read-only — you may not write policy</Badge>
      )}

      <div className="ml-auto flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || blocking || rehearsing}
          onClick={rehearse}
          title={blocking ? "Fix the problems first — a document that does not parse cannot be rehearsed" : undefined}
        >
          <PlayCircle className="size-3.5" />
          {rehearsing ? "Rehearsing…" : "Rehearse"}
        </Button>
      </div>
    </div>
  )
}

/**
 * What the parser and the binder complain about, in the order they complain.
 *
 * ⚠️ **The stage is shown, not just the message.** A syntax error, a name that binds to nothing and a
 * guard refusal are three different next moves — and the third one means the document is well-formed
 * and still refused, which reads as a bug unless it says which stage spoke.
 */
export function PolicyProblems({ workbench }: { workbench: PolicyWorkbench }) {
  if (workbench.problems.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-2">
      {workbench.problems.map((problem, index) => (
        <div key={index} className="flex items-baseline gap-2 text-xs">
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {problem.stage.toLowerCase()}
          </Badge>
          {problem.line > 0 && (
            <span className="shrink-0 font-mono text-muted-foreground">
              {problem.line}:{problem.column}
            </span>
          )}
          <span>{problem.message}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * What a save would do to whom — and the only place a save can be confirmed from.
 *
 * ⚠️ **`changes` and `capabilityChanges` are kept apart** because they are read by different people and
 * mean different things: one is who could suddenly **do** something, the other is who would gain or
 * lose something they are **paying** for. A permission somebody quietly gains is found by whoever
 * audits; a capability an account quietly loses is found by the customer, immediately, and reported as
 * a fault.
 */
export function PolicyDryRun({ workbench }: { workbench: PolicyWorkbench }) {
  const { dryRun, note, setNote, saving, confirmSave, closeDryRun, mayWrite } = workbench

  if (!dryRun) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">What this would do</h3>
        <Badge variant="outline">{dryRun.examined} subjects examined</Badge>
        <Badge variant="outline">{dryRun.accountsExamined} accounts examined</Badge>
        {dryRun.changes.length === 0 && dryRun.capabilityChanges.length === 0 && (
          <Badge variant="secondary">nothing changes for anybody</Badge>
        )}
      </div>

      {dryRun.warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md bg-warning/10 p-2 text-xs">
          {dryRun.warnings.map((warning, index) => (
            <span key={index}>⚠️ {warning}</span>
          ))}
        </div>
      )}

      {dryRun.changes.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-xs font-medium">People</h4>
          {dryRun.changes.map((change) => (
            <div key={`${change.userId}-${change.scope}`} className="flex flex-wrap items-baseline gap-1.5 text-xs">
              <span className="font-medium">{change.email}</span>
              <span className="font-mono text-muted-foreground">{change.scope}</span>
              {change.gains.map((permission) => (
                <span key={`gain-${permission}`} className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-success">
                  + {permission}
                </span>
              ))}
              {change.losses.map((permission) => (
                <span
                  key={`loss-${permission}`}
                  className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-destructive"
                >
                  − {permission}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      {dryRun.capabilityChanges.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-xs font-medium">Accounts — what they are paying for</h4>
          {dryRun.capabilityChanges.map((change) => (
            <div key={`${change.placeId}-${change.scope}`} className="flex flex-wrap items-baseline gap-1.5 text-xs">
              <span className="font-medium">{change.placeName}</span>
              {change.gains.map((capability) => (
                <span key={`gain-${capability}`} className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-success">
                  + {capability}
                </span>
              ))}
              {change.losses.map((capability) => (
                <span
                  key={`loss-${capability}`}
                  className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-destructive"
                >
                  − {capability}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        <Input
          className="max-w-sm text-sm"
          placeholder="Why — kept with the revision"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={closeDryRun}>
            Back to editing
          </Button>
          <Button type="button" size="sm" disabled={!dryRun.valid || !mayWrite || saving} onClick={confirmSave}>
            <Save className="size-3.5" />
            {saving ? "Saving…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Every version that ever was, and one click back to it. */
export function PolicyHistory({ workbench }: { workbench: PolicyWorkbench }) {
  const { history, revertTo, reverting, mayWrite, version } = workbench

  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No revisions yet — nothing has been saved from here.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {history.map((revision) => (
        <div key={revision.version} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
          <Badge variant={revision.version === version ? "default" : "outline"} className="font-mono">
            v{revision.version}
          </Badge>
          <span className="font-mono text-muted-foreground">{revision.createdAt.slice(0, 16).replace("T", " ")}</span>
          <span className="text-muted-foreground">{revision.authorEmail ?? "—"}</span>
          {revision.note && <span className="italic">“{revision.note}”</span>}
          {revision.revertedFrom !== null && <Badge variant="secondary">reverted from v{revision.revertedFrom}</Badge>}
          <span className="text-muted-foreground">
            {revision.roles} roles · {revision.subjects} subjects
          </span>

          {revision.version !== version && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={!mayWrite || reverting}
              onClick={() => revertTo(revision.version)}
              // ⚠️ A revert is a new version, never a rewind: the history keeps growing, and
              // `revertedFrom` is what says where this one came from.
              title="Writes this text as a new version — the history is never rewritten"
            >
              <History className="size-3.5" />
              Revert to this
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
