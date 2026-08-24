import type { FieldDetail } from "@/types"
import { resolveVisible } from "@/lib/formConditions"
import { ChildFieldControl } from "./controls/ChildFieldControl"

/**
 * A virtual field: a heading with its children on one row underneath.
 *
 * ⚠️ **A group is not a field with a value.** Its children each hold their own, which is what
 * distinguishes it from `COMPLEX_COMPOSITE` — that one joins its children into a single piped string
 * and is rendered as an ordinary control, not as a group.
 */
export function VirtualFieldGroup({
  field,
  values,
  errors,
  onChange,
  required,
}: {
  field: FieldDetail
  values: Record<string, string>
  errors: Record<string, string>
  onChange: (fieldName: string, value: string) => void
  required: boolean
}) {
  const children = field.children ?? []
  const childConditions = field.childConditions ?? {}

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-3">
      <legend className="flex items-center gap-1.5 px-1 text-xs font-medium">
        {field.icon && <span aria-hidden="true">{field.icon}</span>}
        <span>{field.label}</span>
        {required && (
          <span className="text-destructive" title="Required" aria-hidden="true">
            ✱
          </span>
        )}
      </legend>

      {children.length === 0 ? (
        <span className="px-1 text-xs text-muted-foreground">No child fields configured.</span>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          {children.map((child) => {
            // ⚠️ A child that already holds a value is shown even when its rule says otherwise — the
            // exception is what stops an entry's own data vanishing from the screen because the chooser
            // above it moved. A phantom is excluded: it is bookkeeping and has nothing to show.
            const visible =
              resolveVisible(child.id, childConditions, values) ||
              (child.usageType !== "PHANTOM" && !!values[child.name])

            if (!visible) {
              return null
            }

            return (
              // ⚠️ **The children SHARE the row; they do not each take what they want.** Left to their
              // natural widths, one long option — "QFN / DFN / UFQFPN — Quad Flat No-lead" — is wider
              // than the panel by itself, and the pin count and its unit wrap onto a second line while
              // the row above them sits half empty. `flex-1` with a 7.5rem ideal and a 5rem floor is
              // the legacy interface's rule (`flex: 1 1 120px; min-width: 80px`), and it is why that
              // one stayed on one line: every segment gives up width together.
              <div key={child.id} className="flex min-w-20 flex-1 basis-30 flex-col gap-1">
                <ChildFieldControl
                  child={child}
                  value={values[child.name] ?? ""}
                  onChange={(value) => onChange(child.name, value)}
                  hasError={!!errors[child.name]}
                />
                {errors[child.name] && <span className="text-xs text-destructive">{errors[child.name]}</span>}
              </div>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
