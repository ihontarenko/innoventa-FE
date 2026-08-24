import { useQueries } from "@tanstack/react-query"
import { Button, Skeleton } from "@jmouse/ui"
import { aggregateApi, type FieldAggregateResult } from "@/api/forms"
import { useForm } from "@/hooks/useForms"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { WidgetEmpty, WidgetField, WidgetInputs, WidgetSelect } from "./WidgetKit"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

/**
 * How a form's answers are distributed, one bar chart per field.
 *
 * ⚠️ **The only feature that reads *across* entries, which is why it is its own `kind`.** A widget draws
 * one row; this draws the shape of all of them — so it belongs on a dashboard rather than on a form, and
 * binding it to one would put a chart of two hundred answers beside the one somebody is filling in.
 *
 * ⚠️ **The counting is the server's.** A distribution assembled in the browser would be a chart of
 * whichever page happened to be loaded — plausible-looking and wrong, which is the worst combination.
 *
 * ⚠️ **Its slots are dynamic**, so the configuration is a list that grows: `field_count` and then
 * `field_1`…`field_n`. That shape is the binding's, not a nicety — the panel writes a flat map of
 * strings and nothing else.
 */
export function EntryAggregatorWidget({ values }: WidgetProperties) {
  const formId = values.form_id ?? ""
  const count = Number.parseInt(values.field_count ?? "1", 10) || 1

  const fieldNames = Array.from({ length: count }, (_unused, index) => values[`field_${index + 1}`] ?? "").filter(
    Boolean,
  )

  const queries = useQueries({
    queries: fieldNames.map((fieldName) => ({
      queryKey: ["form-aggregate", formId, fieldName] as const,
      queryFn: () => aggregateApi.byField(formId, fieldName).then((response) => response.data),
      enabled: Boolean(formId && fieldName),
      staleTime: 30_000,
    })),
  })

  if (!formId) {
    return <WidgetEmpty>Pick a form and at least one field to chart.</WidgetEmpty>
  }

  if (fieldNames.length === 0) {
    return <WidgetEmpty>Pick at least one field to chart.</WidgetEmpty>
  }

  return (
    <div className="flex flex-col gap-4">
      {fieldNames.map((fieldName, index) => (
        <FieldChart
          key={fieldName}
          fieldName={fieldName}
          data={queries[index]?.data}
          isLoading={queries[index]?.isLoading ?? false}
          isError={queries[index]?.isError ?? false}
        />
      ))}
    </div>
  )
}

function FieldChart({
  fieldName,
  data,
  isLoading,
  isError,
}: {
  fieldName: string
  data: FieldAggregateResult | undefined
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }

  if (isError || !data) {
    return <WidgetEmpty>“{fieldName}” did not come back.</WidgetEmpty>
  }

  const total = data.totalEntries

  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-xs font-medium">{fieldName}</span>
        <span className="text-[11px] text-muted-foreground">
          {total} response{total === 1 ? "" : "s"}
        </span>
      </header>

      {data.buckets.length === 0 ? (
        <WidgetEmpty>Nothing answered yet.</WidgetEmpty>
      ) : (
        <div className="flex flex-col gap-1">
          {data.buckets.map((bucket) => {
            const percentage = total > 0 ? Math.round((bucket.count / total) * 100) : 0

            return (
              <div key={bucket.value} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2">
                {/* ⚠️ An empty answer is labelled rather than skipped — "nobody said" is a finding. */}
                <span className="truncate text-xs" title={bucket.value || "(empty)"}>
                  {bucket.value || <em className="text-muted-foreground">(empty)</em>}
                </span>

                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${percentage}%` }}
                  />
                </span>

                <span className="flex items-baseline gap-1.5 font-mono text-[11px]">
                  <span>{bucket.count}</span>
                  <span className="text-muted-foreground">{percentage}%</span>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function EntryAggregatorInputs({ values, onChange }: WidgetInputsProperties) {
  const { data: forms = [] } = useWorkspaceForms()
  const { data: form } = useForm(values.form_id || undefined)

  const fields = form?.fields ?? []
  const count = Number.parseInt(values.field_count ?? "1", 10) || 1

  /**
   * ⚠️ **Changing the form clears every chosen field, and it has to.** Field names belong to a form;
   * carrying them across would leave the chart asking the new form for a field it has never heard of,
   * and the answer to that is an error rather than an empty chart.
   */
  function chooseForm(formId: string) {
    onChange("form_id", formId)
    onChange("field_count", "1")

    for (let index = 1; index <= count; index++) {
      onChange(`field_${index}`, "")
    }
  }

  /** ⚠️ Removal shifts the rest down, because the keys are positional — a hole would end the list. */
  function removeAt(position: number) {
    for (let index = position; index < count; index++) {
      onChange(`field_${index}`, values[`field_${index + 1}`] ?? "")
    }

    onChange(`field_${count}`, "")
    onChange("field_count", String(count - 1))
  }

  return (
    <WidgetInputs>
      <WidgetField label="Form">
        <WidgetSelect wide value={values.form_id ?? ""} onChange={chooseForm}>
          <option value="">— pick a form —</option>
          {forms.map((one) => (
            <option key={one.id} value={one.id}>
              {one.icon ? `${one.icon} ` : ""}
              {one.name}
            </option>
          ))}
        </WidgetSelect>
      </WidgetField>

      {Array.from({ length: count }, (_unused, index) => index + 1).map((position) => (
        <WidgetField key={position} label={`Field ${position}`}>
          <span className="flex items-center gap-1.5">
            <WidgetSelect
              wide
              value={values[`field_${position}`] ?? ""}
              onChange={(next) => onChange(`field_${position}`, next)}
            >
              <option value="">— pick a field —</option>
              {fields.map((field) => (
                <option key={field.id} value={field.name}>
                  {field.label}
                </option>
              ))}
            </WidgetSelect>

            {count > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeAt(position)}>
                ✕
              </Button>
            )}
          </span>
        </WidgetField>
      ))}

      {values.form_id && count < fields.length && (
        <WidgetField label=" ">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(`field_${count + 1}`, "")
              onChange("field_count", String(count + 1))
            }}
          >
            Add a field
          </Button>
        </WidgetField>
      )}
    </WidgetInputs>
  )
}
