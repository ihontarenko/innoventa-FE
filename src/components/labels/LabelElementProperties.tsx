import { Button, Input } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import { minimumSideOf, snap, tidyMm } from "@/lib/labels/labelDesign"
import type {
  BarcodeSymbology,
  LabelAlignment,
  LabelElement,
  LabelImageFit,
  LabelOverflow,
  LabelPlaceholder,
  LabelTemplateDetail,
  QrErrorCorrection,
} from "@/types"

/**
 * What the selected element is, where it is, and what it says.
 *
 * ⚠️ **The panel shows the properties this element ACTUALLY has.** A text box has a font and an overflow
 * mode; a code has a symbology and an error-correction level; a picture has a fit. That is not a set of
 * conditionals guarding one big form — it is the element model showing through, because each type
 * carries its own style object and no other type's.
 *
 * ⚠️ **The content field takes jME and shows what it resolved to** for the previewed record, so a mistake
 * is seen while it is being typed rather than found on a printed sheet.
 */
export function LabelElementProperties({
  element,
  template,
  placeholders,
  resolved,
  failure,
  overflowing,
  onChange,
  onDelete,
}: {
  element: LabelElement
  template: LabelTemplateDetail
  placeholders: LabelPlaceholder[]
  resolved: string | undefined
  failure: string | undefined
  overflowing: boolean
  onChange: (element: LabelElement) => void
  onDelete: () => void
}) {
  const floor = minimumSideOf(element.type)
  const geometry = element.geometry
  const isShape = element.type === "BOX" || element.type === "LINE"

  function setGeometry(patch: Partial<LabelElement["geometry"]>) {
    onChange({ ...element, geometry: { ...geometry, ...patch } })
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{TYPE_LABELS[element.type]}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{element.id}</span>
      </div>

      {!isShape && (
        <EditorField label={CONTENT_LABELS[element.type]}>
          <Input
            value={element.content}
            placeholder={element.type === "IMAGE" ? "A file token, or {{ photo }}" : "{{ label }}"}
            onChange={(event) => onChange({ ...element, content: event.target.value })}
          />
          {resolved !== undefined && (
            <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
              → {resolved || "(empty)"}
            </span>
          )}
          {failure && <span className="mt-1 block text-[11px] text-destructive">{failure}</span>}
        </EditorField>
      )}

      {placeholders.length > 0 && !isShape && (
        <div className="flex flex-col gap-1.5">
          {/* ⚠️ The chip shows the PLACEHOLDER itself, not a tidy human name for it. Labelling these
              "Manufacturer" hid the one thing somebody needs to know — that what goes into the content
              field is `{{ manufacturer }}` — and made the palette look like a list of things you could
              not type yourself. */}
          <span className="text-xs font-medium">Drop in a value</span>
          <div className="flex flex-wrap gap-1">
            {placeholders.map((placeholder) => (
              <button
                key={placeholder.key}
                type="button"
                title={`${placeholder.label} — e.g. ${placeholder.example}`}
                className="rounded-md border px-1.5 py-0.5 text-left transition-colors hover:bg-accent"
                onClick={() => onChange({ ...element, content: `${element.content}{{ ${placeholder.key} }}` })}
              >
                <span className="block font-mono text-[10px]">{`{{ ${placeholder.key} }}`}</span>
                <span className="block text-[10px] text-muted-foreground">{placeholder.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X, mm" value={geometry.x} onCommit={(value) => setGeometry({ x: value })} />
        <NumberField label="Y, mm" value={geometry.y} onCommit={(value) => setGeometry({ y: value })} />
        <NumberField
          label="Width, mm"
          value={geometry.width}
          minimum={floor}
          onCommit={(value) => setGeometry({ width: value })}
        />
        <NumberField
          label="Height, mm"
          value={geometry.height}
          minimum={floor}
          onCommit={(value) => setGeometry({ height: value })}
        />
      </div>

      <EditorField label="Turn">
        <PlainSelect value={String(geometry.rotation)} onChange={(value) => setGeometry({ rotation: Number(value) })}>
          {[0, 90, 180, 270].map((angle) => (
            <option key={angle} value={angle}>
              {angle}°
            </option>
          ))}
        </PlainSelect>
      </EditorField>

      {element.text && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Type size, mm"
              value={element.text.fontSizeMm}
              minimum={1}
              step={0.1}
              onCommit={(value) => onChange({ ...element, text: { ...element.text!, fontSizeMm: value } })}
            />
            <EditorField label="Weight">
              <PlainSelect
                value={element.text.bold ? "bold" : "regular"}
                onChange={(value) => onChange({ ...element, text: { ...element.text!, bold: value === "bold" } })}
              >
                <option value="regular">Regular</option>
                <option value="bold">Bold</option>
              </PlainSelect>
            </EditorField>
          </div>

          <EditorField label="Align">
            <PlainSelect
              value={element.text.align}
              onChange={(value) =>
                onChange({ ...element, text: { ...element.text!, align: value as LabelAlignment } })
              }
            >
              <option value="LEFT">Left</option>
              <option value="CENTER">Centre</option>
              <option value="RIGHT">Right</option>
            </PlainSelect>
          </EditorField>

          <EditorField label="When it does not fit">
            <PlainSelect
              value={element.text.overflow}
              onChange={(value) =>
                onChange({ ...element, text: { ...element.text!, overflow: value as LabelOverflow } })
              }
            >
              <option value="SHRINK">Shrink the type</option>
              <option value="WRAP">Wrap onto more lines</option>
              <option value="CLIP">Cut it off</option>
            </PlainSelect>
          </EditorField>

          {overflowing && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px]">
              The previewed record does not fit this box. Make it bigger, shorten the content, or accept
              that this is what will print.
            </p>
          )}
        </>
      )}

      {element.code && (
        <>
          {element.type === "BARCODE" && (
            <EditorField label="Symbology">
              <PlainSelect
                value={element.code.symbology}
                onChange={(value) =>
                  onChange({ ...element, code: { ...element.code!, symbology: value as BarcodeSymbology } })
                }
              >
                <option value="CODE_128">Code 128 — anything, any length</option>
                <option value="CODE_39">Code 39 — older scanners</option>
                <option value="EAN_13">EAN-13 — retail, 13 digits</option>
                <option value="ITF">ITF — dense, digits only</option>
              </PlainSelect>
            </EditorField>
          )}

          {element.type === "QR" && (
            <EditorField label="Survives damage">
              <PlainSelect
                value={element.code.errorCorrection}
                onChange={(value) =>
                  onChange({ ...element, code: { ...element.code!, errorCorrection: value as QrErrorCorrection } })
                }
              >
                <option value="LOW">About 7% — densest, behind glass</option>
                <option value="MEDIUM">About 15% — an undamaged sticker</option>
                <option value="QUARTILE">About 25% — something handled</option>
                <option value="HIGH">About 30% — something handled badly</option>
              </PlainSelect>
            </EditorField>
          )}

          <NumberField
            label="Quiet zone, modules"
            value={element.code.quietZone}
            minimum={0}
            step={1}
            onCommit={(value) =>
              onChange({ ...element, code: { ...element.code!, quietZone: Math.round(value) } })
            }
          />

          {/* ⚠️ Not a note about taste. A QR under about eight millimetres does not scan on any phone,
              and the failure is discovered in front of a shelf, on a sticker already stuck down. */}
          <p className="text-[11px] text-muted-foreground">
            A code below {minimumSideOf(element.type)} mm does not scan, so it cannot be made smaller.
          </p>
        </>
      )}

      {element.image && (
        <EditorField label="Fit">
          <PlainSelect
            value={element.image.fit}
            onChange={(value) => onChange({ ...element, image: { fit: value as LabelImageFit } })}
          >
            <option value="CONTAIN">Whole picture, letterboxed</option>
            <option value="COVER">Fill the box, cropping</option>
            <option value="FILL">Stretch to the box</option>
          </PlainSelect>
        </EditorField>
      )}

      {element.stroke && (
        <>
          <NumberField
            label="Thickness, mm"
            value={element.stroke.thicknessMm}
            minimum={0.1}
            step={0.1}
            onCommit={(value) => onChange({ ...element, stroke: { ...element.stroke!, thicknessMm: value } })}
          />

          {element.type === "BOX" && (
            <EditorField label="Inside">
              <PlainSelect
                value={element.stroke.filled ? "filled" : "hollow"}
                onChange={(value) =>
                  onChange({ ...element, stroke: { ...element.stroke!, filled: value === "filled" } })
                }
              >
                <option value="hollow">Hollow</option>
                <option value="filled">Filled</option>
              </PlainSelect>
            </EditorField>
          )}
        </>
      )}

      <Button variant="ghost" size="sm" className="self-start text-destructive hover:bg-destructive/10" onClick={onDelete}>
        Remove this element
      </Button>

      {/* ⚠️ The template's own size lives in the header, not here — an element panel that could resize
          the label would make "the size is the design" a thing said in two places. */}
      <p className="text-[11px] text-muted-foreground">
        This label is {template.widthMm}×{template.heightMm} mm.
      </p>
    </div>
  )
}

/**
 * A number that only reaches the design once it IS a number.
 *
 * ⚠️ Typed straight into state, a half-finished "1" on the way to "12" would move the element to one
 * millimetre and back, and clearing the box entirely would move it to zero. It commits on blur and on
 * Enter, snapped to the grid like everything else the studio writes.
 */
function NumberField({
  label,
  value,
  minimum = 0,
  step = 0.5,
  onCommit,
}: {
  label: string
  value: number
  minimum?: number
  step?: number
  onCommit: (value: number) => void
}) {
  function commit(raw: string) {
    const parsed = Number(raw)

    if (!Number.isFinite(parsed)) {
      return
    }

    onCommit(tidyMm(Math.max(minimum, step >= 0.5 ? snap(parsed) : parsed)))
  }

  return (
    <EditorField label={label}>
      <Input
        type="number"
        step={step}
        min={minimum}
        // ⚠️ Keyed on the value so a change made by DRAGGING re-seeds the box — an uncontrolled input
        // would otherwise keep showing whatever was last typed while the element moved under it.
        key={`${label}-${value}`}
        defaultValue={value}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit((event.target as HTMLInputElement).value)
          }
        }}
      />
    </EditorField>
  )
}

const TYPE_LABELS: Record<LabelElement["type"], string> = {
  TEXT: "Text",
  QR: "QR code",
  BARCODE: "Barcode",
  IMAGE: "Picture",
  BOX: "Frame",
  LINE: "Rule",
}

const CONTENT_LABELS: Record<LabelElement["type"], string> = {
  TEXT: "What it says",
  QR: "What the code carries",
  BARCODE: "What the code carries",
  IMAGE: "Which file",
  BOX: "",
  LINE: "",
}
