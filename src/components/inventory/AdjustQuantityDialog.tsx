import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useAdjustStock } from "@/hooks/useStock"
import { useProjects } from "@/hooks/useProjects"
import type { MovementReason } from "@/api/stock"

/**
 * The reasons a quantity moves, and what each of them means for the sign.
 *
 * ⚠️ **The sign is derived from the reason HERE and refused on the server.** A receipt adds, an issue
 * and a write-off take, and a count sets the number to whatever was actually found. Asking somebody to
 * type a minus sign beside a box labelled "issued" is asking them to get it wrong once; sending an
 * unsigned number and letting the server guess is how a client that already signed it double-negates.
 * So the person says *how many* and *why*, and this turns the pair into a signed delta.
 */
const REASONS: {
  value: MovementReason
  label: string
  hint: string
  direction: "in" | "out" | "set"
}[] = [
  { value: "RECEIPT", label: "Received", hint: "They arrived — a delivery, a return, something found", direction: "in" },
  { value: "ISSUE", label: "Issued", hint: "They went somewhere — usually a project", direction: "out" },
  { value: "WRITE_OFF", label: "Written off", hint: "They are gone — broken, lost, spoiled", direction: "out" },
  { value: "COUNT", label: "Counted", hint: "This is what is actually on the shelf", direction: "set" },
]

/**
 * Changing what is on a shelf, by saying what happened to it.
 *
 * <h2>⚠️ There is no other way, and that is the point</h2>
 *
 * The quantity field on the record is read-only after it is created: saving the entry with a different
 * number is refused by the backend with a sentence saying so. The number on a shelf is the sum of
 * everything that ever happened to it, and typing over the total erases the history that explains it.
 *
 * ⚠️ **A count is not an adjustment and is not treated as one.** "There are 96" is the one case where a
 * person knows the answer rather than the change, so the field asks for the total and the delta is
 * worked out — asking somebody standing at a shelf to subtract is how a stocktake ends up wrong.
 */
export function AdjustQuantityDialog({
  entryId,
  label,
  held,
  onClose,
}: {
  entryId: string
  /** What the position is called, so the dialog names the shelf rather than an identifier. */
  label: string
  /** What is there now. ⚠️ `null` where nobody has counted it — which a count can fix and nothing else can. */
  held: number | null
  onClose: () => void
}) {
  const adjust = useAdjustStock()
  const { data: projectPage } = useProjects()

  const [reason, setReason] = useState<MovementReason>("RECEIPT")
  const [amount, setAmount] = useState("")
  const [projectId, setProjectId] = useState("")
  const [note, setNote] = useState("")

  const chosen = REASONS.find((candidate) => candidate.value === reason)!
  const typed = Number.parseFloat(amount)
  const isNumber = Number.isFinite(typed) && typed >= 0

  /**
   * ⚠️ **Shown before it is sent, always.** A signed number is the one thing about this dialog somebody
   * can get wrong without noticing, so the result is stated in words — "96 → 116" — rather than left to
   * be discovered on the row afterwards.
   */
  const delta = useMemo(() => {
    if (!isNumber) {
      return null
    }
    if (chosen.direction === "set") {
      return typed - (held ?? 0)
    }
    return chosen.direction === "in" ? typed : -typed
  }, [chosen.direction, held, isNumber, typed])

  const after = delta === null ? null : (held ?? 0) + delta
  const impossible = after !== null && after < 0
  const nothing = delta === 0

  function send() {
    if (delta === null || impossible || nothing) {
      return
    }

    adjust.mutate(
      {
        entryId,
        delta,
        reason,
        projectId: projectId || undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${label} — ${plus(delta)}, now ${after}`)
          onClose()
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          // ⚠️ The backend's own sentence. It knows whether the refusal is "there are only 100 of these"
          // or "a receipt adds, so its amount is positive", and those are acted on differently.
          toast.error(detail ?? "That was not recorded.")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change the quantity</DialogTitle>
          <DialogDescription>
            {label} — {held === null ? "never counted" : `${held} on the shelf`}. Every change is
            recorded with its reason, so the number can always be explained.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">What happened</span>
            <PlainSelect value={reason} onChange={(next) => setReason(next as MovementReason)}>
              {REASONS.map((candidate) => (
                <option key={candidate.value} value={candidate.value}>
                  {candidate.label}
                </option>
              ))}
            </PlainSelect>
            <span className="text-[11px] text-muted-foreground">{chosen.hint}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">
              {chosen.direction === "set" ? "How many are actually there" : "How many"}
            </span>
            <Input
              autoFocus
              type="number"
              min={0}
              value={amount}
              placeholder={chosen.direction === "set" ? String(held ?? 0) : "0"}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
            />
          </label>

          {/* ⚠️ Only for an issue. A receipt against a project is a sentence nobody means, and offering
              the control on every reason is how somebody fills it in because it was there. */}
          {reason === "ISSUE" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">To which project</span>
              <PlainSelect value={projectId} onChange={setProjectId}>
                <option value="">— none —</option>
                {(projectPage?.content ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </PlainSelect>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Note</span>
            <Input
              value={note}
              placeholder="Where they came from, who took them, why"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && send()}
            />
          </label>

          {delta !== null && (
            <div
              className={cn(
                "rounded-md border px-2.5 py-1.5 font-mono text-sm",
                impossible && "border-destructive/40 bg-destructive/5 text-destructive",
              )}
            >
              {impossible ? (
                <>
                  There are only {held ?? 0} — {Math.abs(delta)} cannot be taken.
                </>
              ) : nothing ? (
                <span className="text-muted-foreground">A movement of nothing is not a movement.</span>
              ) : (
                <>
                  {held ?? 0} <span className="text-muted-foreground">→</span> {after}{" "}
                  <span className="text-muted-foreground">({plus(delta)})</span>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={delta === null || impossible || nothing || adjust.isPending}
            onClick={send}
          >
            Record it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A signed number as somebody writes one: `+20`, `-3`. */
function plus(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}
