import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { LabelCanvas } from "@/components/labels/LabelCanvas"
import { LabelElementProperties } from "@/components/labels/LabelElementProperties"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import {
  useLabelFields,
  useLabelRecordChoices,
  useLabelSubjects,
  useLabelTemplate,
  useResolvedLabel,
  useUpdateLabelTemplate,
} from "@/hooks/useLabels"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { newElement, typeFitsOn } from "@/lib/labels/labelDesign"
import { spaceSectionPath } from "@/lib/navigationContext"
import type { LabelElement, LabelElementType } from "@/types"

/**
 * ⚠️ **A code is deliberately its own kind and never a text element with a mode.** A QR inside a text
 * box would inherit a font, an alignment and an overflow mode that mean nothing to it — and nothing
 * could then enforce the minimum size, because what a template renders to is not knowable while
 * somebody is editing it.
 */
const PALETTE: Array<{ type: LabelElementType; label: string; glyph: string; hint: string }> = [
  { type: "TEXT", label: "Text", glyph: "T", hint: "Words, with a font and an overflow mode" },
  { type: "QR", label: "QR", glyph: "▣", hint: "A QR code, drawn from what its content resolves to" },
  { type: "BARCODE", label: "Barcode", glyph: "|||", hint: "A linear barcode" },
  { type: "IMAGE", label: "Picture", glyph: "◲", hint: "A logo, or whatever file a field points at" },
  { type: "BOX", label: "Frame", glyph: "□", hint: "A rectangle, hollow or filled" },
  { type: "LINE", label: "Rule", glyph: "─", hint: "A line" },
]

/**
 * Designing one label.
 *
 * ⚠️ **The preview sends the design being EDITED, not the one last saved.** Previewing by template id
 * alone would draw a freshly added element blank until somebody pressed Save — the opposite of "a
 * mistake is seen while typing". The design is debounced first, the same shape the live jME blocks use.
 *
 * ⚠️ **The form is not editable here, and that is deliberate.** Every element on the canvas was placed
 * against *these* fields; changing the form would silently turn half of them into placeholders nothing
 * answers for. A design for another form is a new design — or a duplicate, which is one press away.
 */
export function LabelStudioPage() {
  const { spaceSlug, templateId } = useParams<{ spaceSlug: string; templateId: string }>()

  const { data: template, isLoading } = useLabelTemplate(templateId)
  const { data: subjects = [] } = useLabelSubjects()
  const { data: recordChoices = [] } = useLabelRecordChoices(templateId)
  const { data: spaceForms = [] } = useWorkspaceForms()
  const updateTemplate = useUpdateLabelTemplate()

  const [elements, setElements] = useState<LabelElement[]>([])
  const [name, setName] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(6)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [overflowing, setOverflowing] = useState<string[]>([])

  // The design as loaded, so the studio has something to edit and something to compare against.
  useEffect(() => {
    if (template) {
      setElements(template.elements)
      setName(template.name)
    }
  }, [template?.id])

  // Nothing chosen yet, and there is something real to choose: preview against the first one.
  useEffect(() => {
    if (!recordId && recordChoices.length > 0) {
      setRecordId(recordChoices[0].id)
    }
  }, [recordChoices, recordId])

  const settledDesign = useDebouncedValue(elements, 400)
  const { data: preview } = useResolvedLabel(templateId, recordId ?? undefined, settledDesign)

  // ⚠️ The form's own fields FIRST, the structural four after them. That order is the whole answer to
  // "what do I put on this?" — somebody who opened a design for Components wants `{{ manufacturer }}`,
  // not `{{ shareToken }}`, and a palette that led with the latter is why the placeholders looked like
  // there was nothing to insert.
  const { data: fieldPlaceholders = [] } = useLabelFields(template?.subjectKind, template?.formId)
  const structural = subjects.find((subject) => subject.kind === template?.subjectKind)?.structural ?? []
  const placeholders = [...fieldPlaceholders, ...structural]

  const boundForm = spaceForms.find((form) => form.id === template?.formId)
  const selected = elements.find((element) => element.id === selectedId) ?? null

  const designKey = useMemo(() => JSON.stringify(elements), [elements])
  const isDirty = !!template && (designKey !== JSON.stringify(template.elements) || name !== template.name)

  const rememberOverflow = useCallback((ids: string[]) => setOverflowing(ids), [])

  if (isLoading || !template) {
    return (
      <>
        <PageHeader title="Label studio" />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  function replaceElement(next: LabelElement) {
    setElements((current) => current.map((element) => (element.id === next.id ? next : element)))
  }

  function addElement(type: LabelElementType) {
    const created = newElement(type, template!, elements)

    setElements((current) => [...current, created])
    setSelectedId(created.id)
  }

  /** ⚠️ Z-order is a property of the design, not of the order things happened to be added in. */
  function moveInStack(elementId: string, direction: -1 | 1) {
    setElements((current) => {
      const index = current.findIndex((element) => element.id === elementId)
      const target = index + direction

      if (index < 0 || target < 0 || target >= current.length) {
        return current
      }

      const reordered = [...current]
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

      return reordered
    })
  }

  function save() {
    updateTemplate.mutate(
      {
        templateId: template!.id,
        name: name.trim() || template!.name,
        subjectKind: template!.subjectKind,
        formId: template!.formId,
        widthMm: template!.widthMm,
        heightMm: template!.heightMm,
        elements,
      },
      { onError: () => toast.error("That design was not saved.") },
    )
  }

  return (
    <>
      <PageHeader
        title="Label studio"
        description={
          <>
            {boundForm ? `${boundForm.icon ? `${boundForm.icon} ` : ""}${boundForm.name}` : "A form"} ·{" "}
            <span className="font-mono">
              {template.widthMm}×{template.heightMm} mm
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {updateTemplate.isPending ? "Saving…" : isDirty ? "unsaved" : "saved"}
            </span>
            <Button size="sm" disabled={!isDirty || updateTemplate.isPending} onClick={save}>
              Save
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to={spaceSectionPath(spaceSlug!, "labels")}>Done</Link>
            </Button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[200px_1fr_280px]">
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-lg border p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Add</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PALETTE.map((entry) => {
                const fits = typeFitsOn(entry.type, template)

                return (
                  <button
                    key={entry.type}
                    type="button"
                    disabled={!fits}
                    title={fits ? entry.hint : `A ${entry.label.toLowerCase()} does not fit on a label this small`}
                    onClick={() => addElement(entry.type)}
                    className="flex flex-col items-center gap-0.5 rounded-md border p-2 text-xs transition-colors hover:bg-accent disabled:opacity-40"
                  >
                    <span aria-hidden="true" className="font-mono">
                      {entry.glyph}
                    </span>
                    {entry.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">On this label</span>
            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing on it yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {/* ⚠️ Back to front, so the top of this list is the top of the label — which is the
                    order somebody looking at the sticker sees. */}
                {[...elements].reverse().map((element) => (
                  <li
                    key={element.id}
                    onClick={() => setSelectedId(element.id)}
                    className={`group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs ${
                      element.id === selectedId ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {overflowing.includes(element.id) && (
                      <span title="Does not fit" className="text-destructive">
                        !
                      </span>
                    )}
                    <span className="truncate font-mono">{element.id}</span>

                    <span className="ml-auto flex opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Bring forward"
                        className="px-1"
                        onClick={(event) => {
                          event.stopPropagation()
                          moveInStack(element.id, 1)
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Send back"
                        className="px-1"
                        onClick={(event) => {
                          event.stopPropagation()
                          moveInStack(element.id, -1)
                        }}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-lg border">
          {/* ⚠️ Two rows, and the split is what the controls are FOR: what this design is, then how it
              is being looked at. One row of seven controls was a row where the zoom slider and the Save
              button looked like the same kind of thing. */}
          <div className="flex flex-wrap items-end gap-3 border-b p-2.5">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium">Name</span>
              <Input
                className="h-8 text-sm"
                value={name}
                placeholder="What this design is called"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Preview against</span>
              <PlainSelect value={recordId ?? ""} onChange={(value) => setRecordId(value || null)}>
                <option value="">Nothing — show the placeholders</option>
                {recordChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </PlainSelect>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Zoom — {zoom.toFixed(1)} px/mm</span>
              <input
                type="range"
                min={2}
                max={16}
                step={0.5}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>

          {recordChoices.length === 0 && (
            <p className="px-2.5 text-xs text-muted-foreground">
              There is nothing on this form yet, so elements show the placeholders that were typed into
              them rather than real values.
            </p>
          )}

          <LabelCanvas
            template={{ ...template, elements }}
            elements={elements}
            record={recordId ? (preview ?? null) : null}
            selectedId={selectedId}
            zoom={zoom}
            onSelect={setSelectedId}
            onGeometry={(elementId, geometry) => {
              const element = elements.find((candidate) => candidate.id === elementId)

              if (element) {
                replaceElement({ ...element, geometry })
              }
            }}
            onOverflow={rememberOverflow}
          />
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-lg border">
          {selected ? (
            <LabelElementProperties
              element={selected}
              template={template}
              placeholders={placeholders}
              resolved={preview?.elements[selected.id]}
              failure={preview?.failures[selected.id]}
              overflowing={overflowing.includes(selected.id)}
              onChange={replaceElement}
              onDelete={() => {
                setElements((current) => current.filter((element) => element.id !== selectedId))
                setSelectedId(null)
              }}
            />
          ) : (
            <div className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium">Nothing selected</span>
              <span className="text-xs text-muted-foreground">
                Pick something on the label, or add one from the left.
              </span>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
