import { useState, type DragEvent } from "react"
import { ArrowDown, ArrowUp, GripVertical, Plus, X, Zap } from "lucide-react"
import { Button, cn } from "@jmouse/ui"
import type { FieldSummary, FormDetail } from "@/types"
import { fieldTypeOf } from "@/lib/fieldTypes"
import { useDetachField, useMoveField, useMoveFieldTo } from "@/hooks/useForms"

/**
 * The schema, one dense row per field.
 *
 * ⚠️ **Nothing expands in here.** The editor is the other pane, which is what keeps this list scannable
 * at twenty fields — the old builder grew a five-tab panel inside the row somebody was reading.
 *
 * ⚠️ **Drag AND the arrows** (Ivan, 2026-08-19). A drag-only list cannot be reordered from a keyboard,
 * and the arrows are also the only way to move a field by exactly one place without aiming.
 */
export function SchemaList({
  form,
  selectedFieldId,
  onSelect,
  onAttach,
}: {
  form: FormDetail
  selectedFieldId: string | null
  onSelect: (fieldId: string) => void
  onAttach: () => void
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

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Fields</h2>
        <span className="text-xs text-muted-foreground">
          {fields.length} · {requiredCount} required
        </span>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onAttach}>
          <Plus className="size-3.5" />
          Attach
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {fields.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No fields yet — attach one, and it appears here in the order the form asks for it.
          </p>
        )}

        {fields.map((field, index) => (
          <SchemaRow
            key={field.id}
            field={field}
            index={index}
            total={fields.length}
            hasCondition={!!form.fieldConditions?.[field.id]}
            isSelected={selectedFieldId === field.id}
            isDropTarget={overIndex === index && draggingIndex !== index}
            onSelect={() => onSelect(field.id)}
            onDetach={() => detachField.mutate(field.id)}
            onMove={(direction) => moveField.mutate({ fieldId: field.id, direction })}
            onDragStart={() => setDraggingIndex(index)}
            onDragOver={(event) => {
              event.preventDefault()
              setOverIndex(index)
            }}
            onDrop={(event) => onDrop(event, index)}
          />
        ))}
      </div>

      {moveFieldTo.isPending && (
        <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">Reordering…</div>
      )}
    </div>
  )
}

function SchemaRow({
  field,
  index,
  total,
  hasCondition,
  isSelected,
  isDropTarget,
  onSelect,
  onDetach,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  field: FieldSummary
  index: number
  total: number
  hasCondition: boolean
  isSelected: boolean
  isDropTarget: boolean
  onSelect: () => void
  onDetach: () => void
  onMove: (direction: 1 | -1) => void
  onDragStart: () => void
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}) {
  const descriptor = fieldTypeOf(field.elementType)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm",
        isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
        isDropTarget && "outline-2 outline-offset-[-2px] outline-primary",
      )}
    >
      <GripVertical className="size-3.5 shrink-0 cursor-grab opacity-30 group-hover:opacity-70" />

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span aria-hidden="true" title={descriptor.label} className="w-4 shrink-0 text-center">
          {field.icon ?? descriptor.glyph}
        </span>
        <span className="truncate">{field.label}</span>
        <span className={cn("truncate font-mono text-xs", isSelected ? "opacity-70" : "text-muted-foreground")}>
          {field.name}
        </span>
        {field.required && (
          <span className="shrink-0 text-destructive" title="Required">
            ✱
          </span>
        )}
        {hasCondition && (
          <Zap className="size-3 shrink-0 opacity-70" aria-label="Has a condition" />
        )}
      </button>

      {/* Kept beside the drag handle rather than instead of it: this is the keyboard path, and the
          precise one. Hidden until the row is touched so the list stays quiet. */}
      <span className="flex shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`Detach ${field.label}`}
          onClick={onDetach}
        >
          <X className="size-3" />
        </Button>
      </span>
    </div>
  )
}
