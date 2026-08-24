import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Row, RowGroup, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EntryFormDialog } from "@/components/form/EntryFormDialog"
import { useChecklistForms, useInspections, useRecordInspection } from "@/hooks/useMonitoring"
import { useCreateEntry } from "@/hooks/useWorkspaceForms"
import { readableMoment } from "@/lib/dates"
import type { InspectionOutcome } from "@/api/monitoring"

const OUTCOMES: Array<{ value: InspectionOutcome; label: string }> = [
  { value: "PASSED", label: "Passed" },
  { value: "PASSED_WITH_REMARKS", label: "Passed, with remarks" },
  { value: "FAILED", label: "Failed" },
]

/**
 * Checklists carried out on this thing, and how each one came out.
 *
 * ⚠️ **The checklist is an ordinary form, filled in through the ordinary form dialog.** That is the
 * whole design: validation, conditional questions and photographs all work because nothing here
 * re-implements them. What this component adds is one row afterwards saying the submission was about
 * this asset, and what the verdict was.
 *
 * ⚠️ **The verdict is asked before the form opens, not after.** A person decides *I am recording a
 * failure* and then writes down why; asking afterwards invites the answer to be talked out of by the
 * effort already spent filling it in.
 *
 * ⚠️ **An inspection filled in on its own closes no maintenance plan.** Being launched from a due plan
 * is its own ticket, and matching a submitted checklist back to "the plan that was probably waiting
 * for it" is guesswork the moment two plans want the same form.
 */
export function AssetInspections({ assetId }: { assetId: string }) {
  const { data: inspections = [], isLoading } = useInspections(assetId)
  const { data: checklists = [] } = useChecklistForms(assetId)

  const createEntry = useCreateEntry()
  const record = useRecordInspection()

  const [formId, setFormId] = useState("")
  const [outcome, setOutcome] = useState<InspectionOutcome>("PASSED")
  const [filling, setFilling] = useState<string | null>(null)

  const failures = inspections.filter((inspection) => inspection.outcome === "FAILED").length

  return (
    <RowGroup label="Inspections" tally={failures > 0 ? `${failures} failed` : `${inspections.length}`}>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : inspections.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nothing carried out yet. An inspection is a checklist — an acceptance act, a snagging list, a
          calibration sheet — filled in against this thing.
        </p>
      ) : (
        <RowList>
          {inspections.map((inspection) => (
            <Row
              key={inspection.id}
              trailing={
                <Badge variant={inspection.outcome === "FAILED" ? "destructive" : "outline"}>
                  {OUTCOMES.find((entry) => entry.value === inspection.outcome)?.label.toLowerCase()}
                </Badge>
              }
            >
              <RowTitle>{inspection.formName ?? "Checklist"}</RowTitle>
              <RowMeta>{readableMoment(inspection.performedAt)}</RowMeta>
              {inspection.note && <RowMeta>{inspection.note}</RowMeta>}
            </Row>
          ))}
        </RowList>
      )}

      {checklists.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No checklists in this workspace yet. Make a form and give it the <em>Inspection</em> purpose.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PlainSelect value={formId} onChange={setFormId}>
            <option value="">— pick a checklist —</option>
            {checklists.map((checklist) => (
              <option key={checklist.id} value={checklist.id}>
                {checklist.name}
              </option>
            ))}
          </PlainSelect>

          <PlainSelect value={outcome} onChange={(next) => setOutcome(next as InspectionOutcome)}>
            {OUTCOMES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </PlainSelect>

          <Button type="button" size="sm" variant="outline" disabled={!formId} onClick={() => setFilling(formId)}>
            Inspect it
          </Button>
        </div>
      )}

      {filling && (
        <EntryFormDialog
          formId={filling}
          formName={checklists.find((checklist) => checklist.id === filling)?.name}
          submitLabel="Record it"
          isSubmitting={createEntry.isPending || record.isPending}
          onSubmit={async (values) => {
            // Two calls on purpose: the engine owns the submission, and the watch owns the fact that
            // it was about this thing. A single endpoint doing both would be a second submission path.
            const entry = await createEntry.mutateAsync({ formId: filling, fieldValues: values })

            await record.mutateAsync({ assetId, payload: { entryId: entry.id, outcome } })

            toast.success("Recorded.")
            setFilling(null)
            setFormId("")
          }}
          onClose={() => setFilling(null)}
        />
      )}
    </RowGroup>
  )
}
