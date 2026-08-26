import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { Button } from "@jmouse/ui"
import { fieldsApi } from "@/api/fields"
import { fieldTypeOf } from "@/lib/fieldTypes"
import type { FieldDetail } from "@/types"
import { ChildConditionEditor } from "../ChildConditionEditor"
import { EditorSection } from "../EditorSection"

/**
 * The children of a group, and the order they sit in.
 *
 * ⚠️ **Adding and removing a child writes immediately.** A child is a relationship between two fields
 * rather than a column on this one, so it is not part of the draft the Save button flushes — pretending
 * otherwise would mean a Revert that cannot actually take a child back off.
 */
export function CompositionSection({
  field,
  onPickChild,
}: {
  field: FieldDetail
  /** Opens the picker; the builder owns it because it is a dialog over the whole screen. */
  onPickChild: () => void
}) {
  const queryClient = useQueryClient()
  const children = field.children ?? []

  const removeChild = useMutation({
    mutationFn: (childFieldId: string) => fieldsApi.removeChild(field.id, childFieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields", field.id] })
      queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })

  return (
    <EditorSection
      title="Composition"
      icon="⊞"
      badge={children.length}
      hint={field.elementType === "COMPLEX_COMPOSITE" ? "joined into one value" : "each child holds its own value"}
    >
      {children.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          No children yet. A group with none renders as an empty row on the form.
        </span>
      ) : (
        <div className="flex flex-col gap-1">
          {children.map((child, index) => (
            <div key={child.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {fieldTypeOf(child.elementType).glyph}
              </span>
              <span className="truncate">{child.label}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{child.name}</span>
              {child.usageType === "PHANTOM" && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] leading-none">chooser</span>
              )}
              <span className="ml-auto flex items-center">
                <ChildConditionEditor
                  parent={field}
                  child={child}
                  condition={field.childConditions?.[child.id] ?? null}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Remove ${child.label}`}
                  disabled={removeChild.isPending}
                  onClick={() => removeChild.mutate(child.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onPickChild}>
        <Plus className="size-3.5" />
        Add child
      </Button>

      {field.elementType === "COMPLEX_COMPOSITE" && (
        <span className="text-xs text-muted-foreground">
          ⚠️ Order is meaning here — the segments are joined with <span className="font-mono">|</span> in the order
          above, and moving one rewrites what every stored value means.
        </span>
      )}
    </EditorSection>
  )
}
