import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button, Input, Skeleton, Switch } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import {
  useDeleteSubmissionPolicy,
  useSaveSubmissionPolicy,
  useSubmissionPolicy,
} from "@/hooks/useWorkspaceForms"
import type { IdentityStrategy } from "@/types"
import { Pane, PaneField, PaneGrid, PaneSwitchRow } from "./Pane"

/**
 * How a submitter is identified, and therefore what "already answered" can mean.
 *
 * ⚠️ **`ANONYMOUS` cannot count anybody.** With nothing identifying a submitter the caps below have no
 * identity to cap — they still throttle the form as a whole, which is a different and much blunter
 * thing, and the hint has to say so rather than leaving somebody to discover it.
 */
const STRATEGIES: Array<{ value: IdentityStrategy; label: string; what: string }> = [
  { value: "ANONYMOUS", label: "Nobody in particular", what: "No identity at all — the limits throttle the form." },
  { value: "USER", label: "The signed-in account", what: "Counted per account. Useless on a form nobody signs in to." },
  { value: "IP", label: "The address it came from", what: "Counted per client address — the usual choice for a public form." },
  { value: "EMAIL", label: "A field of the answer", what: "Counted per value of one field. Name the field below." },
]

export function SubmissionsPane({ formId, onChanged }: { formId: string; onChanged: (isLimited: boolean) => void }) {
  const { data: policy, isLoading } = useSubmissionPolicy(formId)

  const savePolicy = useSaveSubmissionPolicy()
  const deletePolicy = useDeleteSubmissionPolicy()

  const [strategy, setStrategy] = useState<IdentityStrategy>("ANONYMOUS")
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true)
  const [maxPerIdentity, setMaxPerIdentity] = useState("")
  const [cooldownMinutes, setCooldownMinutes] = useState("")
  const [identityFieldName, setIdentityFieldName] = useState("")
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  // Seeded from the answer once it arrives, and reseeded whenever it changes — including back to
  // nothing after a removal, which is what puts the controls back to the unrestricted defaults.
  useEffect(() => {
    setStrategy(policy?.identityStrategy ?? "ANONYMOUS")
    setResubmissionAllowed(policy?.resubmissionAllowed ?? true)
    setMaxPerIdentity(policy?.maxPerIdentity != null ? String(policy.maxPerIdentity) : "")
    setCooldownMinutes(policy?.cooldownMinutes != null ? String(policy.cooldownMinutes) : "")
    setIdentityFieldName(policy?.identityFieldName ?? "")
  }, [policy])

  if (isLoading) {
    return (
      <Pane title="Submissions">
        <Skeleton className="h-32 w-full" />
      </Pane>
    )
  }

  function save() {
    savePolicy.mutate(
      {
        formId,
        resubmissionAllowed,
        maxPerIdentity: maxPerIdentity ? Number.parseInt(maxPerIdentity, 10) : null,
        cooldownMinutes: cooldownMinutes ? Number.parseInt(cooldownMinutes, 10) : null,
        identityStrategy: strategy,
        identityFieldName: identityFieldName.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Submission policy saved.")
          onChanged(true)
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not save the policy.")
        },
      },
    )
  }

  return (
    <Pane
      title="Submissions"
      hint={
        policy
          ? "Who counts as one submitter, and how often they may answer."
          : "This form accepts as many answers as anybody cares to send."
      }
    >
      <PaneGrid>
        <PaneField label="Who counts as one submitter" hint={STRATEGIES.find((one) => one.value === strategy)?.what}>
          <PlainSelect value={strategy} onChange={(next) => setStrategy(next as IdentityStrategy)}>
            {STRATEGIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </PlainSelect>
        </PaneField>

        {strategy === "EMAIL" && (
          <PaneField label="Which field" hint="The field's name, not its label — the identifier a form refers to.">
            <Input
              className="h-9 font-mono text-sm"
              value={identityFieldName}
              placeholder="email"
              onChange={(event) => setIdentityFieldName(event.target.value)}
            />
          </PaneField>
        )}
      </PaneGrid>

      <PaneSwitchRow
        control={<Switch checked={resubmissionAllowed} onCheckedChange={setResubmissionAllowed} />}
        title="The same submitter may answer again"
        hint="With this off it is once and only once, and the two limits below stop meaning anything."
      />

      <PaneGrid>
        <PaneField label="At most" hint="Blank for no cap.">
          <Input
            type="number"
            min={1}
            className="h-9 text-sm"
            value={maxPerIdentity}
            placeholder="unlimited"
            disabled={!resubmissionAllowed}
            onChange={(event) => setMaxPerIdentity(event.target.value)}
          />
        </PaneField>

        <PaneField label="Not again within" hint="Minutes. Blank for no wait.">
          <Input
            type="number"
            min={1}
            className="h-9 text-sm"
            value={cooldownMinutes}
            placeholder="no wait"
            disabled={!resubmissionAllowed}
            onChange={(event) => setCooldownMinutes(event.target.value)}
          />
        </PaneField>
      </PaneGrid>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={savePolicy.isPending} onClick={save}>
          {policy ? "Save limits" : "Set limits"}
        </Button>

        {/* ⚠️ Removing the policy is what makes a form unrestricted again — a save with the limits
            blanked leaves a row that permits everything while reading as though somebody meant it. */}
        {policy &&
          (confirmingRemoval ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deletePolicy.isPending}
              onClick={() =>
                deletePolicy.mutate(formId, {
                  onSuccess: () => {
                    toast.success("The form is unrestricted again.")
                    setConfirmingRemoval(false)
                    onChanged(false)
                  },
                  onError: () => toast.error("Could not remove the policy."),
                })
              }
            >
              Really remove
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmingRemoval(true)}
            >
              Remove limits
            </Button>
          ))}
      </div>
    </Pane>
  )
}
