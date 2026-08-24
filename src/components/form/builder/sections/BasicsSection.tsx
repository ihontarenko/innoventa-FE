import { Input, Switch, cn } from "@jmouse/ui"
import { FIELD_TYPES, fieldTypesByGroup, USAGE_TYPES } from "@/lib/fieldTypes"
import type { ElementType, UsageType } from "@/types"
import { EditorField, EditorSection } from "../EditorSection"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * Who the field is: its name, its type, and whether it must be answered.
 *
 * ⚠️ **The field id is derived and read-only.** It is what every stored answer is keyed by, so
 * renaming it would orphan the data rather than rename it — the label is what people read, and the two
 * are deliberately not the same thing.
 */
export function BasicsSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, update, derivedName } = editor
  const isComplexComposite = draft.elementType === "COMPLEX_COMPOSITE"

  return (
    <EditorSection title="Basics">
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <EditorField label="Icon">
          <Input
            className="text-center"
            maxLength={4}
            value={draft.icon}
            onChange={(event) => update({ icon: event.target.value })}
          />
        </EditorField>

        <EditorField label="Label">
          <Input value={draft.label} onChange={(event) => update({ label: event.target.value })} />
        </EditorField>
      </div>

      <EditorField label="Field id" hint="Derived from the label — every stored answer is keyed by it.">
        <Input readOnly className="font-mono text-muted-foreground" value={derivedName} />
      </EditorField>

      <div className="grid grid-cols-2 gap-2">
        <EditorField label="Type">
          <select
            className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
            value={draft.elementType}
            onChange={(event) => {
              const elementType = event.target.value as ElementType

              // ⚠️ A multi-segment field is always a group — its value is assembled from children, so a
              // standalone one would have nothing to assemble. The old editor made you set both and
              // let you get it wrong.
              update(elementType === "COMPLEX_COMPOSITE" ? { elementType, usageType: "VIRTUAL" } : { elementType })
            }}
          >
            {fieldTypesByGroup().map(([group, descriptors]) => (
              <optgroup key={group} label={group}>
                {descriptors.map((descriptor) => (
                  <option key={descriptor.id} value={descriptor.id}>
                    {descriptor.glyph} {descriptor.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </EditorField>

        <EditorField label="Usage">
          {isComplexComposite ? (
            <span className="flex h-9 items-center text-xs text-muted-foreground">
              Locked to <strong className="mx-1">Group</strong> — multi-segment fields always are.
            </span>
          ) : (
            <select
              className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
              value={draft.usageType}
              onChange={(event) => update({ usageType: event.target.value as UsageType })}
            >
              {USAGE_TYPES.map((usage) => (
                <option key={usage.value} value={usage.value}>
                  {usage.label}
                </option>
              ))}
            </select>
          )}
        </EditorField>
      </div>

      <span className="text-xs text-muted-foreground">
        {FIELD_TYPES.find((descriptor) => descriptor.id === draft.elementType)?.hint}
      </span>

      <label className={cn("flex cursor-pointer items-center gap-2 pt-1 text-sm")}>
        <Switch checked={draft.required} onCheckedChange={(required) => update({ required })} />
        <span>Required</span>
        <span className="text-xs text-muted-foreground">
          — a condition on the form can still make it optional.
        </span>
      </label>
    </EditorSection>
  )
}
