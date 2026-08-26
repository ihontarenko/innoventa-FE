import { Label } from "@jmouse/ui"
import type { FieldDetail } from "@/types"
import { displayHintOf } from "@/lib/fieldConfigs"
import { FieldControl } from "./FieldControl"
import { FieldHelp, isLongHint } from "./FieldHelp"

/**
 * One labelled row of a form: the label, the control, and one line under it.
 *
 * ⚠️ **Error and hint share that line, and the error wins.** Two lines under a control push the next
 * field down the moment something is wrong, so a long form jumps around while it is being corrected —
 * and the hint is advice about filling the field in, which is exactly what stops mattering once the
 * answer has been rejected.
 *
 * ⚠️ **A long hint is not on that line at all — it is behind the help control beside the label.** Prose
 * explaining a rule is read once and then re-read past forever; left under the control it pushes every
 * field below it down the screen every time the form is opened. The threshold, and why there is one
 * rather than a single rule for every hint, is in `FieldHelp`.
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
  const isBehindHelp = isLongHint(hint)

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
        {isBehindHelp && <FieldHelp label={field.label} hint={hint!} />}
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
        !isBehindHelp && hint && <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}
