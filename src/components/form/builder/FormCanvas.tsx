import { useState, type DragEvent, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { Badge, Button } from "@jmouse/ui"
import type { FieldSummary, FormDetail } from "@/types"
import { fieldTypeOf } from "@/lib/fieldTypes"
import { useDetachField, useMoveField, useMoveFieldTo } from "@/hooks/useForms"
import { FieldCard } from "./FieldCard"

/**
 * The form as a stack of its questions, in the order it asks them.
 *
 * ⚠️ **The editor opens INSIDE the row, and this is a reversal of a decision made deliberately.** The
 * two-pane builder existed because the old interface expanded a row into five tabs inside a 16-rem
 * column, and the list somebody was navigating by moved under them every time. What was wrong there was
 * the width, not the place: a card that owns the full column lays its sections out two-up, so opening a
 * field now shows more at once than the pane ever did — and the row stays exactly where it was clicked.
 *
 * ⚠️ **One field open at a time.** Two open editors are two drafts, each with its own unsaved state and
 * its own ⌘S, and the one that loses work is always the one scrolled off the screen.
 *
 * ⚠️ **Drag AND the arrows** (Ivan, 2026-08-19). A drag-only list cannot be reordered from a keyboard,
 * and the arrows are also the only way to move a field by exactly one place without aiming. Dragging is
 * switched off on an open row — a card the height of the screen is not a thing anybody aims with.
 */
export function FormCanvas({
  form,
  expandedFieldId,
  onExpand,
  onAttach,
  renderEditor,
}: {
  form: FormDetail
  expandedFieldId: string | null
  onExpand: (fieldId: string | null) => void
  onAttach: () => void
  /** The editor for the open row. The canvas never knows what it takes — see `FormBuilder`. */
  renderEditor: (field: FieldSummary) => ReactNode
}) {
  const detachField = useDetachField(form.id)
  const moveField = useMoveField(form.id)
  const moveFieldTo = useMoveFieldTo(form.id)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const fields = form.fields.filter((field) => field.status !== "DELETED")
  const requiredCount = fields.filter((field) => field.required).length

  function onDrop(event: DragEvent, toIndex: number) {
    event.preventDefault()

    if (draggingIndex === null || draggingIndex === toIndex) {
      setDraggingIndex(null)
      setOverIndex(null)
      return
    }

    moveFieldTo.mutate({ fieldId: fields[draggingIndex].id, from: draggingIndex, to: toIndex })
    setDraggingIndex(null)
    setOverIndex(null)
  }

  // ⚠️ **No scroller of its own any more.** The builder is an ordinary screen now, and the layout's
  // content area is what scrolls — a canvas with its own `overflow-y-auto` inside a page that also
  // scrolls is two scrollbars, and the inner one traps the wheel over the questions.
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      <header className="flex items-center gap-2 border-b pb-2">
        <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase">Questions</h2>
        <span className="text-xs text-muted-foreground">
          {fields.length} · {requiredCount} required
        </span>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAttach}>
          <Plus className="size-3.5" />
          Attach a field
        </Button>
      </header>

      <div>
        <div className="flex flex-col gap-1.5 py-3">
          {fields.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-10 text-center text-xs text-muted-foreground">
              No fields yet — attach one, and it appears here in the order the form asks for it.
            </p>
          )}

          {fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              ordinal={index + 1}
              hasCondition={!!form.fieldConditions?.[field.id]}
              isExpanded={expandedFieldId === field.id}
              onToggle={() => onExpand(expandedFieldId === field.id ? null : field.id)}
              isDropTarget={overIndex === index && draggingIndex !== index}
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => {
                event.preventDefault()
                setOverIndex(index)
              }}
              onDrop={(event) => onDrop(event, index)}
              badges={<Badge variant="secondary">{fieldTypeOf(field.elementType).label}</Badge>}
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveField.mutate({ fieldId: field.id, direction: -1 })}
                  >
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Move down"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField.mutate({ fieldId: field.id, direction: 1 })}
                  >
                    <ArrowDown className="size-3" />
                  </Button>
                  {/* ⚠️ Detach, not delete. The field goes on living in the catalogue and on every
                      other form carrying it — this only stops THIS form asking it. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={`Detach ${field.label}`}
                    onClick={() => detachField.mutate(field.id)}
                  >
                    <X className="size-3" />
                  </Button>
                </>
              }
            >
              {renderEditor(field)}
            </FieldCard>
          ))}
        </div>
      </div>

      {moveFieldTo.isPending && <div className="border-t py-1.5 text-xs text-muted-foreground">Reordering…</div>}
    </div>
  )
}
