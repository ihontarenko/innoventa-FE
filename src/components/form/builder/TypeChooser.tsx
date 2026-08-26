import { cn } from "@jmouse/ui"
import type { ElementType, UsageType } from "@/types"
import { FIELD_TYPES, USAGE_TYPES, fieldTypesByGroup } from "@/lib/fieldTypes"

/**
 * What a field *is*, picked by eye rather than out of a dropdown.
 *
 * ⚠️ **A grid of glyphs, not a `<select>` with `optgroup`s.** Twenty-one element types behind a closed
 * dropdown means the only ones anybody ever discovers are the four they already know the names of —
 * `Quantity` and `Multi-segment` are exactly the two nobody finds by guessing, and they are the two that
 * make this product's forms different from a survey tool's. Open on the page, with the glyph the field
 * will carry everywhere else, they are picked in one movement and read in none.
 *
 * ⚠️ **The two axes stay separate.** `elementType` is what a value looks like; `usageType` is where the
 * field may stand. They are drawn as two rows of the same card because they are asked together, never
 * because they are one question — a control that merged them would have to invent combinations the
 * backend has no name for.
 */
export function TypeChooser({
  elementType,
  usageType,
  onChange,
}: {
  elementType: ElementType
  usageType: UsageType
  onChange: (patch: { elementType?: ElementType; usageType?: UsageType }) => void
}) {
  // ⚠️ A multi-segment field is always a group — its value is assembled from children, so a standalone
  // one would have nothing to assemble. The old editor made you set both and let you get it wrong.
  const isComplexComposite = elementType === "COMPLEX_COMPOSITE"

  return (
    <div className="flex flex-col gap-3">
      {fieldTypesByGroup().map(([group, descriptors]) => (
        <div key={group} className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group}</span>
          <div className="flex flex-wrap gap-1">
            {descriptors.map((descriptor) => (
              <button
                key={descriptor.id}
                type="button"
                title={descriptor.hint}
                aria-pressed={descriptor.id === elementType}
                onClick={() =>
                  onChange(
                    descriptor.id === "COMPLEX_COMPOSITE"
                      ? { elementType: descriptor.id, usageType: "VIRTUAL" }
                      : { elementType: descriptor.id },
                  )
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  descriptor.id === elementType
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-transparent bg-muted/60 hover:border-border hover:bg-accent",
                )}
              >
                <span aria-hidden="true" className="w-3.5 text-center">
                  {descriptor.glyph}
                </span>
                <span className="whitespace-nowrap">{descriptor.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
        {FIELD_TYPES.find((descriptor) => descriptor.id === elementType)?.hint}
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Usage</span>

        {isComplexComposite ? (
          <p className="rounded-md border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground">
            Locked to <strong className="text-foreground">Composite</strong> — a multi-segment field is
            assembled from its children, so it is always a group.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {USAGE_TYPES.map((usage) => (
              <button
                key={usage.value}
                type="button"
                title={usage.hint}
                aria-pressed={usage.value === usageType}
                onClick={() => onChange({ usageType: usage.value })}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  usage.value === usageType
                    ? "border-foreground/20 bg-secondary text-secondary-foreground"
                    : "border-transparent bg-muted/60 hover:border-border hover:bg-accent",
                )}
              >
                <span aria-hidden="true">{usage.glyph}</span>
                <span className="whitespace-nowrap">{usage.label}</span>
              </button>
            ))}
          </div>
        )}

        <span className="text-[11px] leading-snug text-muted-foreground">
          {USAGE_TYPES.find((usage) => usage.value === (isComplexComposite ? "VIRTUAL" : usageType))?.hint}
        </span>
      </div>
    </div>
  )
}
