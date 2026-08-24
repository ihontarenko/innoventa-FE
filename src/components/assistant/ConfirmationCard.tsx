import { useEffect, useState } from "react"
import { Badge, Button } from "@jmouse/ui"
import { confirmationInstruction } from "@/lib/assistantTranscript"
import type { ConfirmationPreview } from "@/lib/assistantTranscript"

interface ConfirmationCardProperties {
  preview: ConfirmationPreview
  /** Which action was previewed — named on the card, because the token authorises only that one. */
  action: string
  /** Whether this is the pending decision, or a record of one already taken. */
  live: boolean
  busy: boolean
  onConfirm: (instruction: string) => void
}

/**
 * What would happen, before it happens — and the button that agrees to it.
 *
 * ⚠️ **The list is the protection; the button is only the ceremony.** The guard froze a specific set of
 * records and issued a token that authorises those and nothing else, so this card shows all of them
 * rather than a count: "42 entries" is a number somebody nods at, and forty-two names is a list somebody
 * reads. Anything added since the preview is not affected, which the card says out loud because it is
 * the one thing about a frozen set that surprises people.
 *
 * ⚠️ **Confirming sends a message, in words, that the person can read.** It is not a side channel — the
 * instruction appears in the transcript exactly as it was sent, naming the action, the count and the
 * token. A conversation where pressing a button inserts something invisible is one where nobody can
 * afterwards say what was agreed to.
 */
export function ConfirmationCard({ preview, action, live, busy, onConfirm }: ConfirmationCardProperties) {
  const secondsLeft = useSecondsLeft(preview.expiresInSeconds, live && !preview.redeemed)
  const expired = secondsLeft === 0
  const decided = preview.redeemed || !live

  return (
    <section
      className={[
        "flex flex-col gap-3 rounded-md border p-3",
        decided ? "border-border opacity-70" : "border-destructive/40 bg-destructive/5",
      ].join(" ")}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant={decided ? "secondary" : "destructive"}>Confirmation needed</Badge>
        <code className="font-mono text-xs">{action}</code>
        <span className="ml-auto text-xs text-muted-foreground">
          {preview.count} {preview.count === 1 ? "record" : "records"}
        </span>
      </header>

      {preview.reason && <p className="text-sm">{preview.reason}</p>}

      {preview.records.length > 0 && (
        <ul className="flex flex-col gap-1">
          {preview.records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
              <span className="font-medium">{record.label}</span>
              {record.kind && <span className="text-muted-foreground">{record.kind}</span>}
              <code className="ml-auto font-mono text-[11px] text-muted-foreground">{record.id}</code>
            </li>
          ))}
        </ul>
      )}

      {preview.records.length < preview.count && (
        <p className="text-xs text-muted-foreground">
          Showing {preview.records.length} of {preview.count} — the rest are affected too.
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {decided && <span>{preview.redeemed ? "Confirmed and carried out." : "Superseded by a later preview."}</span>}

        {!decided && expired && (
          <span>This preview has expired. Ask again to see a fresh list — it may have changed.</span>
        )}

        {!decided && !expired && (
          <>
            <span>
              Only these are affected — anything added since is not. Expires in {secondsLeft}s.
            </span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => onConfirm(confirmationInstruction(preview, action))}
            >
              {busy ? "Confirming…" : "Confirm"}
            </Button>
          </>
        )}
      </footer>
    </section>
  )
}

/**
 * How long this token has left, counted from the moment the card appeared.
 *
 * ⚠️ Mount time stands in for issue time — the card is drawn as soon as the answer carrying it arrives,
 * and the transcript keys each preview by its own call so nothing remounts it afterwards. A second or
 * two of drift on a lifetime measured in minutes is not worth carrying a timestamp for.
 *
 * ⚠️ It ticks so the card cannot go on offering a button for a token the server would refuse. The
 * refusal itself is perfectly clear — it says the token expired and what to do instead — but it costs a
 * round trip to learn something the screen already knew.
 */
function useSecondsLeft(lifetime: number, ticking: boolean): number {
  const [expiresAt] = useState(() => Date.now() + lifetime * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) {
      return
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(timer)
  }, [ticking])

  return Math.max(0, Math.round((expiresAt - now) / 1000))
}
