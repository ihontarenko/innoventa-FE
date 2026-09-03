import { useEffect, useState } from "react"
import { Badge, Skeleton } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
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
      <ListScreen
        title="Watch"
        description={`The numbers this workspace collects about its ${things}, and what makes one fall due`}
        /* ⚠️ Chips rather than a rail. The rail earns its width over a catalogue — many customer-named
            choices with counts — and a workspace describes its things with one or two forms. */
        chips={
          watchesEquipment && assetForms.length > 1
            ? assetForms.map((form) => ({
                label: form.name,
                active: selectedId === form.id,
                onClick: () => setSelectedId(form.id),
              }))
            : []
        }
        action={
          watchesEquipment
            ? /* ⚠️ Here rather than on Assets: this is the screen somebody is standing on when the
                 question in their head is "what does this workspace look after", and a ready kind is
                 an answer to that rather than to "register one more drill". */
              { label: `Add a ${kind}`, onClick: () => setAddingKind(true) }
            : undefined
        }
        loading={watchesEquipment && formsQuery.isLoading}
        isEmpty={watchesEquipment && assetForms.length === 0}
        /* ⚠️ **The empty state offers the catalogue, and that is where it earns its keep.** Somebody
            standing here has just been told that what is measured belongs to a class of things and
            that they have no classes — a correct sentence and a dead end. The ready kinds are the way
            out of it. */
        empty={{
          title: "No form describes a thing yet",
          text: 'What is measured belongs to a class of things — "excavators are serviced every 250 motorhours" is one rule over every excavator. Take a ready one, or build your own with the purpose ASSET in the form library.',
          actions: [{ label: `Add a ${kind}`, primary: true, onClick: () => setAddingKind(true) }],
        }}
      >
        <div className="p-4">
          {!watchesEquipment ? <ModuleOff /> : selectedId && <WatchedForm formId={selectedId} />}
        </div>
      </ListScreen>

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
