import { Input, cn } from "@jmouse/ui"
import type { FieldSummary } from "@/types"

/**
 * One segment of a composite, or one input of a jMouse-EL live block.
 *
 * ⚠️ **A child is a `FieldSummary`, not a `FieldDetail`** — it has no attributes, no configuration and
 * no children of its own. That is the whole reason this is a separate, much smaller renderer rather
 * than a recursive call into `FieldControl`: recursion would promise a depth the model does not have.
 */
export function ChildFieldControl({
  child,
  value,
  onChange,
  hasError,
}: {
  child: FieldSummary
  value: string
  onChange: (value: string) => void
  hasError?: boolean
}) {
  if (child.elementType === "NUMBER") {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step="any"
          aria-label={child.label}
          aria-invalid={hasError || undefined}
          className={cn("w-full min-w-0 font-mono", hasError && "border-destructive")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={child.label || "0"}
        />
        {child.unit && <span className="shrink-0 font-mono text-xs text-muted-foreground">{child.unit}</span>}
      </div>
    )
  }

  const options = child.options ?? []

  if ((child.elementType === "SELECT" || child.elementType === "RADIO") && options.length > 0) {
    return (
      <select
        aria-label={child.label}
        title={child.label}
        className={cn(
          "h-9 w-full min-w-0 truncate rounded-md border bg-transparent px-2 text-sm shadow-xs",
          hasError && "border-destructive",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— {child.label}</option>
        {options.map((option) => (
          <option key={option.optionValue} value={option.optionValue}>
            {option.optionLabel}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      aria-label={child.label}
      aria-invalid={hasError || undefined}
      className={cn("w-full min-w-0", hasError && "border-destructive")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={child.label}
    />
  )
}
