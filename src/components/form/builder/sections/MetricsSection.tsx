import { useState } from "react"
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField, EditorSection } from "@/components/form/builder/EditorSection"
import {
  useCreateMetric,
  useDeleteMetric,
  useMetrics,
  useReorderMetrics,
  useUpdateMetric,
} from "@/hooks/useMonitoring"
import type { EquipmentMetric, MetricKind } from "@/api/monitoring"
import type { FormDetail } from "@/types"

const KINDS: Array<{ value: MetricKind; label: string; hint: string }> = [
  {
    value: "COUNTER",
    label: "Counter",
    hint: "Only ever goes up, and a plan counts the distance since the last service — motorhours, mileage, print count.",
  },
  {
    value: "MEASUREMENT",
    label: "Measurement",
    hint: "A number at a moment, moving either way, and a plan watches it leave a range — temperature, pressure, charge.",
  },
]

const BLANK: MetricDraft = { code: "", name: "", unit: "", kind: "COUNTER", decimalPlaces: 0 }

interface MetricDraft {
  code: string
  name: string
  unit: string
  kind: MetricKind
  decimalPlaces: number
}

/**
 * What this workspace measures about the things this form describes.
 *
 * ⚠️ **Here rather than in a menu, and that is the model showing through.** Motorhours belong to the
 * excavator form and to nothing else; a global "Metrics" screen would have to grow a form picker to say
 * the one thing this panel's location already says.
 *
 * ⚠️ **`kind` is the only field that changes behaviour, so it is asked with its consequence attached.**
 * Everything else here is words, a unit and an order. Changing it on a metric that already carries
 * readings re-reads all of them as something else, which is why editing it is a deliberate act on an
 * existing row rather than a dropdown people brush past.
 *
 * ⚠️ **The unit is text and nothing computes with it.** No normalising, no conversion: a reading is only
 * ever compared with readings of the same metric on the same asset, and °C reduces to Kelvin by an
 * offset rather than by a prefix.
 */
export function MetricsSection({ form }: { form: FormDetail }) {
  const { data: metrics = [], isLoading } = useMetrics(form.id)

  const createMetric  = useCreateMetric()
  const reorder       = useReorderMetrics()

  const [draft, setDraft] = useState<MetricDraft>(BLANK)

  function add() {
    if (!draft.code.trim() || !draft.name.trim()) {
      return
    }

    createMetric.mutate(
      { formId: form.id, payload: { ...draft, unit: draft.unit.trim() || null } },
      {
        onSuccess: () => setDraft(BLANK),
        onError: () => toast.error("That metric was not added."),
      },
    )
  }

  function move(metric: EquipmentMetric, by: -1 | 1) {
    const order = metrics.map((candidate) => candidate.id)
    const from  = order.indexOf(metric.id)
    const to    = from + by

    if (to < 0 || to >= order.length) {
      return
    }

    order.splice(to, 0, ...order.splice(from, 1))

    reorder.mutate(
      { formId: form.id, metricIds: order },
      { onError: () => toast.error("That order was not saved.") },
    )
  }

  return (
    <EditorSection title="Metrics" badge={metrics.length || undefined} defaultOpen={metrics.length > 0}>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : metrics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing measured yet. A metric is what somebody reads off one of these things and writes down —
          hours on a dial, a temperature, a page count — and it is what a maintenance plan counts.
        </p>
      ) : (
        metrics.map((metric, index) => (
          <MetricRow
            key={metric.id}
            metric={metric}
            formId={form.id}
            isFirst={index === 0}
            isLast={index === metrics.length - 1}
            onMove={(by) => move(metric, by)}
          />
        ))
      )}

      <EditorField label="Add one" hint="The code is what a plan and a reading name it by.">
        <div className="grid grid-cols-[7rem_1fr_4.5rem] gap-2">
          <Input
            className="font-mono"
            placeholder="motorhours"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <Input
            placeholder="Motorhours"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <Input
            placeholder="h"
            value={draft.unit}
            onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
          />
        </div>
      </EditorField>

      <EditorField label="How it behaves" hint={KINDS.find((entry) => entry.value === draft.kind)?.hint}>
        <div className="flex gap-2">
          <PlainSelect value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind: kind as MetricKind })}>
            {KINDS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </PlainSelect>

          <Input
            type="number"
            min={0}
            max={6}
            className="w-20"
            title="Decimal places"
            value={draft.decimalPlaces}
            onChange={(event) => setDraft({ ...draft, decimalPlaces: Number(event.target.value) })}
          />

          <Button type="button" size="sm" className="ml-auto" disabled={createMetric.isPending} onClick={add}>
            Add
          </Button>
        </div>
      </EditorField>
    </EditorSection>
  )
}

/**
 * One metric, edited in place.
 *
 * ⚠️ **Every change saves on blur, the way a widget mapping does.** A metric is a handful of reversible
 * facts with no draft to assemble, and a Save button here is a button people forget — leaving a metric
 * half-renamed and a plan naming a code that no longer means what it says.
 */
function MetricRow({
  metric,
  formId,
  isFirst,
  isLast,
  onMove,
}: {
  metric: EquipmentMetric
  formId: string
  isFirst: boolean
  isLast: boolean
  onMove: (by: -1 | 1) => void
}) {
  const updateMetric = useUpdateMetric()
  const deleteMetric = useDeleteMetric()

  const [name, setName] = useState(metric.name)
  const [unit, setUnit] = useState(metric.unit ?? "")

  function save(changes: Partial<Pick<EquipmentMetric, "name" | "unit" | "kind" | "decimalPlaces">>) {
    updateMetric.mutate(
      {
        formId,
        metricId: metric.id,
        payload: {
          code: metric.code,
          name: changes.name ?? name,
          unit: (changes.unit ?? unit).trim() || null,
          kind: changes.kind ?? metric.kind,
          decimalPlaces: changes.decimalPlaces ?? metric.decimalPlaces,
          quantityKindId: metric.quantityKindId,
        },
      },
      { onError: () => toast.error("That change was not saved.") },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{metric.code}</span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" disabled={isFirst} onClick={() => onMove(-1)}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={isLast} onClick={() => onMove(1)}>
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              deleteMetric.mutate(
                { formId, metricId: metric.id },
                { onError: () => toast.error("That metric was not removed.") },
              )
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} onBlur={() => save({ name })} />
        <Input value={unit} onChange={(event) => setUnit(event.target.value)} onBlur={() => save({ unit })} />
      </div>

      <div className="flex items-center gap-2">
        <PlainSelect value={metric.kind} onChange={(kind) => save({ kind: kind as MetricKind })}>
          {KINDS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </PlainSelect>

        <Input
          type="number"
          min={0}
          max={6}
          className="w-20"
          title="Decimal places"
          defaultValue={metric.decimalPlaces}
          onBlur={(event) => save({ decimalPlaces: Number(event.target.value) })}
        />
      </div>
    </div>
  )
}
