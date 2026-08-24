import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge, Button, Input, Skeleton, Switch } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField, EditorSection } from "@/components/form/builder/EditorSection"
import { useCreatePlan, useDeletePlan, useMetrics, usePlans, useUpdatePlan } from "@/hooks/useMonitoring"
import type { MaintenancePlan, PlanRequest, TriggerKind } from "@/api/monitoring"
import type { FormDetail } from "@/types"

const TRIGGERS: Array<{ value: TriggerKind; label: string; hint: string }> = [
  {
    value: "COUNTER",
    label: "Every so much use",
    hint: "Counted from the reading frozen at the last service — every 250 motorhours.",
  },
  {
    value: "CALENDAR",
    label: "Every so long",
    hint: "By the clock, needing no reading at all — every 12 months. ⚠️ This one falls due with nobody writing anything.",
  },
  {
    value: "RANGE",
    label: "When it leaves a range",
    hint: "Not a schedule: a measurement outside its bounds — below 2 °C, above 8 bar.",
  },
]

const BLANK: Draft = {
  name: "",
  triggerKind: "COUNTER",
  metricId: "",
  intervalAmount: "",
  warnAheadAmount: "",
  rangeMinimum: "",
  rangeMaximum: "",
  expectedReadingIntervalDays: "",
  sendsToService: false,
}

interface Draft {
  name: string
  triggerKind: TriggerKind
  metricId: string
  intervalAmount: string
  warnAheadAmount: string
  rangeMinimum: string
  rangeMaximum: string
  expectedReadingIntervalDays: string
  sendsToService: boolean
}

/**
 * The maintenance rules this class of things carries.
 *
 * ⚠️ **A rule belongs to the class, and never to one thing.** "Excavators are serviced every 250
 * motorhours" is one row governing five hundred excavators; *when this one is due* comes from its own
 * readings and its own service history and is stored nowhere. There is deliberately no per-asset
 * override here — nobody has named an exception yet, and the table for one migrates nothing.
 *
 * ⚠️ **`expectedReadingIntervalDays` is the field people skip and then regret.** A counter plan fires
 * only when somebody records hours; if nobody does, it never fires, and silence looks exactly like
 * "nothing is due". This is what lets the product say *motorhours not recorded for 40 days*.
 */
export function PlansSection({ form }: { form: FormDetail }) {
  const { data: plans = [], isLoading } = usePlans(form.id)
  const { data: metrics = [] } = useMetrics(form.id)

  const createPlan = useCreatePlan()

  const [draft, setDraft] = useState<Draft>(BLANK)

  function add() {
    if (!draft.name.trim()) {
      return
    }

    createPlan.mutate(
      { formId: form.id, payload: payloadOf(draft) },
      {
        onSuccess: () => setDraft(BLANK),
        onError: () => toast.error("That rule was not written — check what it needs."),
      },
    )
  }

  const needsMetric = draft.triggerKind !== "CALENDAR"

  return (
    <EditorSection title="Maintenance" badge={plans.length || undefined} defaultOpen={plans.length > 0}>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : plans.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rules yet. A rule governs every one of these things at once — <em>every 250 motorhours</em>,{" "}
          <em>every 12 months</em>, <em>below 2 °C</em> — and when each individual one is due is worked
          out from its own readings.
        </p>
      ) : (
        plans.map((plan) => <PlanRow key={plan.id} plan={plan} formId={form.id} />)
      )}

      <EditorField label="Write a rule">
        <Input
          placeholder="Service"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </EditorField>

      <EditorField label="What makes it due" hint={TRIGGERS.find((entry) => entry.value === draft.triggerKind)?.hint}>
        <PlainSelect
          value={draft.triggerKind}
          onChange={(triggerKind) => setDraft({ ...draft, triggerKind: triggerKind as TriggerKind })}
        >
          {TRIGGERS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </PlainSelect>
      </EditorField>

      {needsMetric && (
        <EditorField label="Watching" hint="Only a metric of this form — that is what makes the rule about these things.">
          <PlainSelect value={draft.metricId} onChange={(metricId) => setDraft({ ...draft, metricId })}>
            <option value="">— pick a metric —</option>
            {metrics
              .filter((metric) => (draft.triggerKind === "COUNTER" ? metric.kind === "COUNTER" : metric.kind === "MEASUREMENT"))
              .map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.name}
                  {metric.unit ? ` (${metric.unit})` : ""}
                </option>
              ))}
          </PlainSelect>
        </EditorField>
      )}

      {draft.triggerKind === "RANGE" ? (
        <EditorField label="Bounds" hint="Leave one empty for unbounded on that side.">
          <div className="flex items-center gap-2">
            <Input
              className="font-mono"
              placeholder="min"
              value={draft.rangeMinimum}
              onChange={(event) => setDraft({ ...draft, rangeMinimum: event.target.value })}
            />
            <span className="text-xs text-muted-foreground">…</span>
            <Input
              className="font-mono"
              placeholder="max"
              value={draft.rangeMaximum}
              onChange={(event) => setDraft({ ...draft, rangeMaximum: event.target.value })}
            />
          </div>
        </EditorField>
      ) : (
        <EditorField
          label="Every"
          hint={draft.triggerKind === "CALENDAR" ? "In months." : "In the metric's own unit."}
        >
          <div className="flex items-center gap-2">
            <Input
              className="w-24 font-mono"
              placeholder={draft.triggerKind === "CALENDAR" ? "12" : "250"}
              value={draft.intervalAmount}
              onChange={(event) => setDraft({ ...draft, intervalAmount: event.target.value })}
            />
            <Input
              className="w-24 font-mono"
              placeholder="warn at"
              title="How far ahead it starts warning"
              value={draft.warnAheadAmount}
              onChange={(event) => setDraft({ ...draft, warnAheadAmount: event.target.value })}
            />
          </div>
        </EditorField>
      )}

      {needsMetric && (
        <EditorField
          label="Expect a reading every"
          hint="⚠️ In days. Without it, a rule that nobody records numbers for never fires — and silence reads as 'nothing is due'."
        >
          <Input
            className="w-24 font-mono"
            placeholder="30"
            value={draft.expectedReadingIntervalDays}
            onChange={(event) => setDraft({ ...draft, expectedReadingIntervalDays: event.target.value })}
          />
        </EditorField>
      )}

      <div className="flex items-center gap-2">
        <Switch
          checked={draft.sendsToService}
          onCheckedChange={(sendsToService) => setDraft({ ...draft, sendsToService })}
        />
        <span className="text-xs">Falling due takes it out of service</span>

        <Button type="button" size="sm" className="ml-auto" disabled={createPlan.isPending} onClick={add}>
          Add
        </Button>
      </div>
    </EditorSection>
  )
}

function PlanRow({ plan, formId }: { plan: MaintenancePlan; formId: string }) {
  const updatePlan = useUpdatePlan()
  const deletePlan = useDeletePlan()

  return (
    <div className="flex items-start gap-2 rounded-md border px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm">{plan.name}</span>
          {!plan.active && <Badge variant="outline">off</Badge>}
          {plan.sendsToService && <Badge variant="destructive">out of service</Badge>}
        </div>
        <span className="text-xs text-muted-foreground">{describe(plan)}</span>
      </div>

      <Switch
        checked={plan.active}
        title="Switched off keeps its history readable; deleting does not"
        onCheckedChange={(active) =>
          updatePlan.mutate(
            { formId, planId: plan.id, payload: { ...payloadOfPlan(plan), active } },
            { onError: () => toast.error("That change was not saved.") },
          )
        }
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() =>
          deletePlan.mutate(
            { formId, planId: plan.id },
            { onError: () => toast.error("That rule was not removed.") },
          )
        }
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

/** One line a person reads instead of six fields. */
function describe(plan: MaintenancePlan): string {
  const unit = plan.metricUnit ? ` ${plan.metricUnit}` : ""

  if (plan.triggerKind === "CALENDAR") {
    return `every ${plan.intervalAmount ?? "?"} ${(plan.intervalUnit ?? "MONTH").toLowerCase()}(s)`
  }

  if (plan.triggerKind === "RANGE") {
    const below = plan.rangeMinimum ? `below ${plan.rangeMinimum}${unit}` : null
    const above = plan.rangeMaximum ? `above ${plan.rangeMaximum}${unit}` : null

    return [plan.metricName, [below, above].filter(Boolean).join(" or ")].filter(Boolean).join(" — ")
  }

  return `every ${plan.intervalAmount ?? "?"}${unit} of ${plan.metricName ?? "—"}`
}

function payloadOf(draft: Draft): PlanRequest {
  return {
    name: draft.name.trim(),
    triggerKind: draft.triggerKind,
    metricId: draft.triggerKind === "CALENDAR" ? null : draft.metricId || null,
    intervalAmount: draft.triggerKind === "RANGE" ? null : draft.intervalAmount || null,
    // The unit is never asked for: a counter counts in the metric's own, a calendar in months.
    intervalUnit: draft.triggerKind === "RANGE" ? null : draft.triggerKind === "CALENDAR" ? "MONTH" : "METRIC",
    warnAheadAmount: draft.warnAheadAmount || null,
    rangeMinimum: draft.rangeMinimum || null,
    rangeMaximum: draft.rangeMaximum || null,
    expectedReadingIntervalDays: draft.expectedReadingIntervalDays
      ? Number(draft.expectedReadingIntervalDays)
      : null,
    sendsToService: draft.sendsToService,
    active: true,
  }
}

function payloadOfPlan(plan: MaintenancePlan): PlanRequest {
  return {
    name: plan.name,
    triggerKind: plan.triggerKind,
    metricId: plan.metricId,
    intervalAmount: plan.intervalAmount,
    intervalUnit: plan.intervalUnit,
    warnAheadAmount: plan.warnAheadAmount,
    rangeMinimum: plan.rangeMinimum,
    rangeMaximum: plan.rangeMaximum,
    expectedReadingIntervalDays: plan.expectedReadingIntervalDays,
    sendsToService: plan.sendsToService,
    inspectionFormId: plan.inspectionFormId,
    active: plan.active,
  }
}
