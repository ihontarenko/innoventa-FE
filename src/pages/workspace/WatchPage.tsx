import { useEffect, useState } from "react"
import { Badge, Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { ToggleChip } from "@/components/ToggleChip"
import { AddKindDialog } from "@/components/custody/AddKindDialog"
import { MetricsSection } from "@/components/form/builder/sections/MetricsSection"
import { PlansSection } from "@/components/form/builder/sections/PlansSection"
import { useAssetForms } from "@/hooks/useCustody"
import { useForm } from "@/hooks/useForms"
import { useMetrics, useMonitoringModule, usePlans } from "@/hooks/useMonitoring"
import { useTerm } from "@/hooks/useTerminology"
import { describeQueryFailure } from "@/lib/loadFailure"

/**
 * What this workspace keeps an eye on: the numbers it collects, and the rules that make something fall
 * due.
 *
 * ⚠️ **This screen is a place, and that is the whole ticket.** Both panels below already existed and
 * were correct — inside the settings sheet of one form, five clicks from anywhere somebody stands. And
 * until a metric exists the attention board is empty, so the product's answer to *what does the watch
 * do* was a screen saying "nothing needs you" for ever. A mechanism nobody can find is indistinguishable
 * from a mechanism that is not there.
 *
 * ⚠️ **The form is the spine, not a picker bolted on.** `MetricsSection` argues in its own header that a
 * global metrics list would have to grow a form picker to say what its location already said — which is
 * right, and is why this is a list *of forms*, each showing what it watches. The address of a metric is
 * still the placement `(space_id, form_id)`, and nothing here flattens it — one rule over every
 * excavator is what a placement buys, and a per-thing metric would give that up.
 *
 * ⚠️ **One form's schema is fetched at a time.** `MetricsSection` and `PlansSection` take a `FormDetail`,
 * and asking for every asset form's full schema to draw a sidebar would be a request per row for data no
 * row shows.
 */
export function WatchPage() {
  const watchesEquipment = useMonitoringModule()

  const formsQuery = useAssetForms()
  const assetForms = formsQuery.data ?? []
  const failure = describeQueryFailure(formsQuery, "asset forms")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingKind, setAddingKind] = useState(false)

  const term = useTerm()
  const things = term("thing.many", "things")
  const kind = term("kind.one", "kind")

  // The first form, once they land — a screen that opens on nothing makes somebody click to see
  // anything at all, and there is nothing to choose between until they have looked at one.
  useEffect(() => {
    if (!selectedId && assetForms.length > 0) {
      setSelectedId(assetForms[0].id)
    }
  }, [assetForms, selectedId])

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void formsQuery.refetch()} />
  }

  return (
    <>
      <PageHeader
        title="Watch"
        description={`The numbers this workspace collects about its ${things}, and what makes one fall due`}
        actions={
          watchesEquipment ? (
            /* ⚠️ Here rather than on Assets: this is the screen somebody is standing on when the
               question in their head is "what does this workspace look after", and a ready kind is an
               answer to that rather than to "register one more drill". */
            <Button size="sm" variant="outline" onClick={() => setAddingKind(true)}>
              Add a {kind}
            </Button>
          ) : undefined
        }
      />

      {!watchesEquipment ? (
        <ModuleOff />
      ) : formsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : assetForms.length === 0 ? (
        <NothingToWatch onAddKind={() => setAddingKind(true)} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* ⚠️ Chips rather than a filter column. `FilterPanel` earns its width over a catalogue —
              many customer-named choices with counts — and a workspace describes its things with one
              or two forms. Its own header calls this the case chips are for. */}
          {assetForms.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {assetForms.map((form) => (
                <ToggleChip
                  key={form.id}
                  active={selectedId === form.id}
                  onClick={() => setSelectedId(form.id)}
                >
                  {form.name}
                </ToggleChip>
              ))}
            </div>
          )}

          {selectedId && <WatchedForm formId={selectedId} />}
        </div>
      )}

      {addingKind && <AddKindDialog onClose={() => setAddingKind(false)} />}
    </>
  )
}

/**
 * One class of things, and everything the workspace watches about it.
 *
 * ⚠️ **Plans after metrics, never before.** A rule names a metric, so a plan editor offered first is a
 * picker with nothing in it — the same order the settings sheet keeps, for the same reason.
 */
function WatchedForm({ formId }: { formId: string }) {
  const formQuery = useForm(formId)
  const form = formQuery.data

  const { data: metrics = [] } = useMetrics(formId)
  const { data: plans = [] } = usePlans(formId)

  const failure = describeQueryFailure(formQuery, "form")

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void formQuery.refetch()} />
  }

  if (!form) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{form.name}</h2>
        <Badge variant="secondary">{metrics.length} measured</Badge>
        <Badge variant="secondary">{plans.length} rules</Badge>
      </div>

      {metrics.length === 0 && plans.length === 0 && (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          Nothing is watched about {form.name.toLowerCase()} yet. A <strong>counter</strong> only goes up
          and a rule counts the distance since the last service — motorhours, mileage, prints. A{" "}
          <strong>measurement</strong> is a number at a moment and a rule watches it leave a range —
          temperature, pressure, charge. Add one below, then give it a rule.
        </p>
      )}

      <div className="rounded-md border">
        <MetricsSection form={form} />
        <PlansSection form={form} />
      </div>
    </div>
  )
}

function ModuleOff() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ⚙
      </span>
      <span className="text-sm font-medium">This workspace does not watch its things</span>
      <span className="max-w-md text-xs text-muted-foreground">
        Custody answers who holds a thing. The watch answers what state it is in — hours run, checks
        passed, service due. It is a module, and this workspace does not have it switched on.
      </span>
    </div>
  )
}

/**
 * ⚠️ **The empty state offers the catalogue, and that is where it earns its keep.** Somebody standing
 * here has just been told that what is measured belongs to a class of things and that they have no
 * classes — which is a correct sentence and a dead end. The ready kinds are the way out of it.
 */
function NothingToWatch({ onAddKind }: { onAddKind: () => void }) {
  const term = useTerm()
  const kind = term("kind.one", "kind")

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ▣
      </span>
      <span className="text-sm font-medium">No form describes a thing yet</span>
      <span className="max-w-md text-xs text-muted-foreground">
        What is measured belongs to a class of things — "excavators are serviced every 250 motorhours" is
        one rule over every excavator. Take a ready one below, or build your own with the purpose{" "}
        <code className="font-mono text-[0.7rem]">ASSET</code> in the form library.
      </span>
      <Button size="sm" className="mt-2" onClick={onAddKind}>
        Add a {kind}
      </Button>
    </div>
  )
}
