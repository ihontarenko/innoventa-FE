import { useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Input,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
  Textarea,
} from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import {
  useCurrentValues,
  usePickableMetrics,
  useReadingHistory,
  useRecordReading,
} from "@/hooks/useMonitoring"
import { readableMoment, relativeTime } from "@/lib/dates"
import type { CurrentValue } from "@/api/monitoring"

/**
 * What this thing has been measured at, and the act of writing down one more.
 *
 * ⚠️ **A metric nobody has recorded is shown, not hidden.** "Nobody has ever looked at the motorhours
 * on this excavator" is the fact a monitor exists to surface — a list of only what has numbers would
 * make the gap invisible, which is the one failure mode worse than being wrong.
 *
 * ⚠️ **The warning from a falling counter is shown until it is dismissed.** The reading is written
 * either way; the warning is the product asking whether an instrument was replaced or a digit is
 * wrong, and a toast that vanishes in four seconds is not asking.
 */
export function AssetReadings({ assetId }: { assetId: string }) {
  const { data: values = [], isLoading } = useCurrentValues(assetId)

  const [recording, setRecording] = useState(false)
  const [openMetricId, setOpenMetricId] = useState<string | null>(null)

  const recorded = values.filter((value) => value.value !== null).length

  return (
    <RowGroup label="What it reads" tally={`${recorded}/${values.length}`}>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : values.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Nothing is measured about these things yet. Metrics are defined on the form that describes
          them, under its settings.
        </p>
      ) : (
        <RowList>
          {values.map((value) => (
            <CurrentValueRow
              key={value.metricId}
              assetId={assetId}
              value={value}
              isOpen={openMetricId === value.metricId}
              onToggle={() =>
                setOpenMetricId((previous) => (previous === value.metricId ? null : value.metricId))
              }
            />
          ))}
        </RowList>
      )}

      {values.length > 0 &&
        (recording ? (
          <RecordReadingForm assetId={assetId} onDone={() => setRecording(false)} />
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setRecording(true)}>
            Write down a reading
          </Button>
        ))}
    </RowGroup>
  )
}

function CurrentValueRow({
  assetId,
  value,
  isOpen,
  onToggle,
}: {
  assetId: string
  value: CurrentValue
  isOpen: boolean
  onToggle: () => void
}) {
  const history = useReadingHistory(assetId, isOpen ? value.metricId : undefined)

  return (
    <>
      <Row
        onOpen={onToggle}
        trailing={
          value.value === null ? (
            <Badge variant="outline">never recorded</Badge>
          ) : (
            <span className="font-mono text-sm">
              {value.value}
              {value.unit ? ` ${value.unit}` : ""}
            </span>
          )
        }
      >
        <RowTitle>{value.metricName}</RowTitle>
        <RowMeta>
          {value.kind === "COUNTER" ? "counter" : "measurement"}
          {value.takenAt ? ` · ${relativeTime(value.takenAt)}` : " · nothing written yet"}
        </RowMeta>
      </Row>

      {isOpen && (
        <div className="border-l-2 border-l-muted px-3 py-2">
          {history.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (history.data?.content.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No history — nothing has been written yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {history.data?.content.map((reading) => (
                <li key={reading.id} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono">
                    {reading.value}
                    {reading.unit ? ` ${reading.unit}` : ""}
                  </span>
                  <span className="text-muted-foreground">{readableMoment(reading.takenAt)}</span>
                  {reading.note && <span className="truncate text-muted-foreground">— {reading.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

export function RecordReadingForm({ assetId, onDone }: { assetId: string; onDone: () => void }) {
  const { data: metrics = [] } = usePickableMetrics(assetId)
  const { data: current = [] } = useCurrentValues(assetId)
  const recordReading = useRecordReading()

  const [metricId, setMetricId] = useState("")
  const [value, setValue] = useState("")
  const [takenAt, setTakenAt] = useState("")
  const [note, setNote] = useState("")
  const [warning, setWarning] = useState<string | null>(null)

  // ⚠️ The picker's order is the backend's — what this thing already carries numbers for comes first.
  // Re-sorting here would throw away the one piece of knowledge the list was built to carry.
  const chosen = metricId || metrics[0]?.id || ""

  // ⚠️ **What it read last, beside the box it is typed into.** The commonest fault on a counter is a
  // number that goes backwards — a transposed digit, or a replaced instrument — and the backend answers
  // with a warning after the fact. Showing the previous value is what stops most of them being typed.
  const previous = current.find((value) => value.metricId === chosen)

  function submit() {
    if (!chosen || !value.trim()) {
      return
    }

    recordReading.mutate(
      {
        assetId,
        payload: {
          metricId: chosen,
          value: value.trim(),
          takenAt: takenAt.trim() || null,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          setValue("")
          setNote("")

          if (result.warning) {
            // Kept on screen rather than toasted: it is a question, and a question that disappears
            // by itself has not been asked.
            setWarning(result.warning)
            return
          }

          setWarning(null)
          onDone()
        },
        onError: () => toast.error("That reading was not written down."),
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <EditorField
        label="What was read"
        hint={
          previous?.value
            ? `Last read ${previous.value}${previous.unit ? ` ${previous.unit}` : ""}${
                previous.takenAt ? ` ${relativeTime(previous.takenAt)}` : ""
              }.`
            : "Nothing has been written down for this one yet."
        }
      >
        <div className="flex gap-2">
          <PlainSelect value={chosen} onChange={setMetricId}>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
                {metric.unit ? ` (${metric.unit})` : ""}
              </option>
            ))}
          </PlainSelect>

          <Input
            className="w-32 font-mono"
            inputMode="decimal"
            placeholder="1250.5"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      </EditorField>

      <EditorField
        label="When"
        hint="Leave empty for now. ⚠️ Friday's hours entered on Monday must say Friday — the plan counts this, not when you typed it."
      >
        <Input type="datetime-local" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} />
      </EditorField>

      <EditorField label="Note">
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </EditorField>

      {warning && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          {warning}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {warning ? "Done" : "Cancel"}
        </Button>
        <Button type="button" size="sm" disabled={recordReading.isPending} onClick={submit}>
          Write it down
        </Button>
      </div>
    </div>
  )
}
