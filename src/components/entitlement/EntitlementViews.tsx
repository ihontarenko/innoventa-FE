import { Badge, cn, Row, RowAction, RowMeta, RowTitle } from "@jmouse/ui"
import type { Grant, Usage } from "@/api/entitlements"
import { readableDate } from "@/lib/dates"

/**
 * The two shapes every plan screen prints: a usage meter and a grant line.
 *
 * Shared because the administrator's screen and the customer's must not disagree about what a trial or
 * a gift looks like. A support conversation where the two sides are reading differently worded versions
 * of the same row is one that goes in circles.
 */

/**
 * How much of one thing is allowed, and how much is used.
 *
 * ⚠️ **An allowance without a count is a number in a table, and a count without an allowance is
 * telemetry** — so both are always shown. Including when the allowance is "no ceiling", where the bar is
 * deliberately **absent** rather than empty: a bar at zero percent reads as *you have used none of your
 * quota*, when the truth is that there is no quota.
 */
export function UsageMeter({ usage }: { usage: Usage }) {
  const proportion = usage.unlimited || !usage.allowance ? 0 : Math.min(1, usage.used / usage.allowance)

  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{usage.label}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {usage.unlimited
            ? `${formatAmount(usage.used, usage)} · no limit`
            : usage.granted
              ? `${usage.used} of ${formatAmount(usage.allowance ?? 0, usage)}`
              : "not included"}
        </span>
      </div>

      {!usage.unlimited && usage.granted && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", proportion >= 1 ? "bg-destructive" : "bg-primary")}
            style={{ width: `${proportion * 100}%` }}
          />
        </div>
      )}

      {/* When it comes back — but only where there is something to come back to. Telling somebody with
          no ceiling that their allowance refreshes in September answers a question they cannot have had. */}
      {usage.resetsAt && !usage.unlimited && usage.granted && (
        <p className="text-[11px] text-muted-foreground">Refreshes on {readableDate(usage.resetsAt)}.</p>
      )}
      {!usage.granted && usage.words && <p className="text-[11px] text-muted-foreground">{usage.words}</p>}
    </div>
  )
}

/**
 * One grant, with its provenance visible.
 *
 * ⚠️ **The source badge is the whole reason this is not just a sentence.** A gift and a plan inclusion
 * read almost identically in prose, and the difference — whether it survives a downgrade — is exactly
 * what somebody deciding to downgrade needs to know.
 *
 * **One line, not two.** It used to print the capability's name above a sentence that opened with the
 * same name — "Entries / Unlimited entries, included in your plan" — a row a reader has to read twice to
 * learn one thing. The sentence already names what it is about, so the sentence is the row.
 */
export function GrantLine({
  grant,
  scope,
  onWithdraw,
}: {
  grant: Grant
  scope?: "subject"
  /** Absent where the reader may not take it back — which is most places this appears. */
  onWithdraw?: () => void
}) {
  return (
    <Row
      tone={grant.active ? undefined : "muted"}
      leading={<span aria-hidden="true">{grant.kind === "DENY" ? "⊘" : "◈"}</span>}
      trailing={
        <>
          {/* Where a list mixes a workspace's own grants with its organisation's, saying which is which
              is the difference between "somebody did this to us" and "this is what we pay for". Off by
              default: a list of one subject's grants would just repeat itself. */}
          {scope === "subject" && <Badge variant="outline">{SUBJECT_LABELS[grant.subjectType]}</Badge>}

          <Badge variant={badgeVariantFor(grant)}>{grant.active ? sourceLabel(grant) : "ended"}</Badge>

          {onWithdraw && grant.active && (
            <RowAction>
              <button
                type="button"
                onClick={onWithdraw}
                title="Withdraw this grant"
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                ✕
              </button>
            </RowAction>
          )}
        </>
      }
    >
      <RowTitle>{grant.words}</RowTitle>
      {grant.grantedBy && <RowMeta>Granted by {grant.grantedBy}.</RowMeta>}
    </Row>
  )
}

const SUBJECT_LABELS: Record<Grant["subjectType"], string> = {
  ORGANIZATION: "account",
  SPACE: "this workspace",
  MEMBERSHIP: "one person",
}

function badgeVariantFor(grant: Grant): "default" | "secondary" | "outline" | "destructive" {
  if (grant.kind === "DENY") {
    return "destructive"
  }

  if (grant.source === "TRIAL") {
    return "default"
  }

  return grant.source === "PLAN" ? "secondary" : "outline"
}

function sourceLabel(grant: Grant): string {
  if (grant.kind === "DENY") {
    return "withheld"
  }

  return {
    PLAN: "in your plan",
    PURCHASE: "bought",
    GRANT: "given",
    TRIAL: "trial",
  }[grant.source]
}

/**
 * A number with its unit, pluralised the way the catalogue says.
 *
 * ⚠️ The plural comes from the backend rather than from appending an *s* here, because English does not
 * work that way: `entry` becomes *entries*, and "0 entrys" on a customer's usage screen is the kind of
 * small wrongness that makes a paid product look unfinished.
 */
function formatAmount(amount: number, usage: Pick<Usage, "unit" | "unitPlural">): string {
  if (usage.unit === "byte") {
    return formatBytes(amount)
  }

  if (!usage.unit) {
    return String(amount)
  }

  return `${amount} ${amount === 1 ? usage.unit : (usage.unitPlural ?? usage.unit)}`
}

/** Bytes are the one unit nobody reads raw: 5368709120 means nothing, 5 GB means something. */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}
