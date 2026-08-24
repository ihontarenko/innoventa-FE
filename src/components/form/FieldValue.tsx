import { cn } from "@jmouse/ui"
import { fileLinks, parseFileFieldValue } from "@/api/files"
import { normalizeValueForUI } from "@/lib/fieldValues"
import type { FieldOption } from "@/types"

/**
 * One stored value, rendered where it is read rather than where it is typed.
 *
 * ⚠️ **Text goes through {@link normalizeValueForUI} and nothing else does.** That function is the one
 * place a composite becomes `22 pF` and a choice becomes its label, and it returns *text* on purpose —
 * an image, a file, a link and a colour are markup, and a formatter that returned markup would be
 * unusable in an `alt`, a `title` or a search snippet. So the rich types are handled here, above it,
 * and everything else is handed down.
 *
 * ⚠️ **An unset value is an em dash, never blank.** A blank cell in a table reads as a column that does
 * not apply; a dash reads as a question nobody answered, which is the thing somebody goes and fixes.
 */
export function FieldValue({
  value,
  elementType,
  unit,
  options,
  children,
  prefix,
  suffix,
  decimalPlaces,
  imageClassName,
  className,
}: {
  value: string
  elementType?: string
  unit?: string | null
  options?: Array<Pick<FieldOption, "optionValue" | "optionLabel">>
  /** A composite's parts, already resolved — rendered as `4.7 kΩ / ±1%` rather than as a raw `4.7|k`. */
  children?: Array<{ label: string; unit: string | null; value: string }>
  prefix?: string
  suffix?: string
  decimalPlaces?: number
  imageClassName?: string
  className?: string
}) {
  const type = elementType ?? ""
  const file = parseFileFieldValue(value)
  const isComposite = type === "COMPLEX_COMPOSITE" || (type === "NONE" && (children?.length ?? 0) > 0)

  if (isComposite) {
    const parts = (children ?? [])
      .filter((child) => child.value)
      .map((child) => (child.unit ? `${child.value} ${child.unit}` : child.value))

    return <span className={className}>{parts.length > 0 ? parts.join(" / ") : "—"}</span>
  }

  if (type === "IMAGE") {
    if (!value) {
      return <span className={className}>—</span>
    }

    const source = file ? fileLinks.view(file.viewToken) : /^https?:\/\//i.test(value) ? value : null

    if (!source) {
      return <span className={className}>{value}</span>
    }

    return <img src={source} alt="" className={cn("size-8 rounded object-contain", imageClassName)} />
  }

  if (!value || value === "—") {
    return <span className={cn("text-muted-foreground", className)}>—</span>
  }

  if (type === "COLOR") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span aria-hidden="true" className="size-3 shrink-0 rounded-full border" style={{ background: value }} />
        <span className="font-mono text-[11px]">{value}</span>
      </span>
    )
  }

  if (type === "FILE" || file) {
    return (
      <span className={className}>
        📎 {file ? file.filename : value}
      </span>
    )
  }

  if (type === "URL" || /^https?:\/\//i.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={cn("truncate text-primary hover:underline", className)}
        title={value}
      >
        {value}
      </a>
    )
  }

  if (type === "NUMBER") {
    // ⚠️ `toFixed` only when a number is what arrived. A field configured for two decimals still
    // collects "n/a" from somewhere, and `NaN.toFixed(2)` renders the string "NaN" into the table.
    const numeric = Number(value)
    const shown = decimalPlaces !== undefined && !Number.isNaN(numeric) ? numeric.toFixed(decimalPlaces) : value
    const unitText = unit ? unit.split(",")[0].trim() : ""

    return (
      <span className={cn("font-mono", className)}>
        {prefix}
        <strong className="font-medium">{shown}</strong>
        {unitText ? ` ${unitText}` : ""}
        {suffix ? ` ${suffix}` : ""}
      </span>
    )
  }

  return (
    <span className={className}>
      {prefix}
      {normalizeValueForUI(value, { elementType, unit, options })}
      {suffix}
    </span>
  )
}
