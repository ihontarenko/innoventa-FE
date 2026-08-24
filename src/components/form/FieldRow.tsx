import { Label } from "@jmouse/ui"
import type { FieldDetail } from "@/types"
import { displayHintOf } from "@/lib/fieldConfigs"
import { FieldControl } from "./FieldControl"

/**
 * One labelled row of a form: the label, the control, and one line under it.
 *
 * ⚠️ **Error and hint share that line, and the error wins.** Two lines under a control push the next
 * field down the moment something is wrong, so a long form jumps around while it is being corrected —
 * and the hint is advice about filling the field in, which is exactly what stops mattering once the
 * answer has been rejected.
 */
export function FieldRow({
  field,
  value,
  onChange,
  error,
  required,
  draftValues,
  optionLabels,
}: {
  field: FieldDetail
  value: string
  onChange: (value: string) => void
  error?: string
  required: boolean
  draftValues?: Record<string, string>
  optionLabels?: Record<string, string>
}) {
  const hint = displayHintOf(field)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`field-${field.id}`} className="flex items-center gap-1.5 text-xs">
        {field.icon && <span aria-hidden="true">{field.icon}</span>}
        <span>{field.label}</span>
        {required && (
          <span className="text-destructive" title="Required" aria-hidden="true">
            ✱
          </span>
        )}
      </Label>

      <FieldControl
        field={field}
        value={value}
        onChange={onChange}
        hasError={!!error}
        draftValues={draftValues}
        optionLabels={optionLabels}
      />

      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}
