import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { labelSvg } from "@/lib/labels/labelSvg"
import { clampToLabel, guidesFor, type AlignmentGuide } from "@/lib/labels/labelDesign"
import type { LabelElement, LabelTemplateDetail, ResolvedLabelRecord } from "@/types"

/**
 * The label, at its true proportions, with handles on top of it.
 *
 * ⚠️ **The label itself is drawn by `labelSvg` and nothing else.** What this component adds is the layer
 * above: a selection outline and eight resize handles, positioned in the same millimetre coordinates and
 * scaled by the same zoom. Keeping the two apart is what makes *the studio and the printer are one
 * layout implementation* true rather than aspirational — the handles are not part of the label and never
 * reach paper.
 *
 * ⚠️ **Zoom is pixels per millimetre and lives only here.** Every number that leaves this component is
 * millimetres snapped to the half-millimetre grid — `clampToLabel` does both, so a dragged element and a
 * number typed into the property panel land on the same coordinates. A stored pixel would be a
 * measurement that means something different on the next monitor.
 */

/** The eight ways a rectangle can be resized, as the corner or edge each handle owns. */
const HANDLES = [
  { key: "nw", x: 0, y: 0 },
  { key: "n", x: 0.5, y: 0 },
  { key: "ne", x: 1, y: 0 },
  { key: "w", x: 0, y: 0.5 },
  { key: "e", x: 1, y: 0.5 },
  { key: "sw", x: 0, y: 1 },
  { key: "s", x: 0.5, y: 1 },
  { key: "se", x: 1, y: 1 },
] as const

type HandleKey = (typeof HANDLES)[number]["key"]

interface DragState {
  elementId: string
  handle: HandleKey | null
  startX: number
  startY: number
  origin: LabelElement["geometry"]
}

export function LabelCanvas({
  template,
  elements,
  record,
  selectedId,
  zoom,
  onSelect,
  onGeometry,
  onOverflow,
}: {
  template: LabelTemplateDetail
  elements: LabelElement[]
  record: ResolvedLabelRecord | null
  selectedId: string | null
  zoom: number
  onSelect: (elementId: string | null) => void
  onGeometry: (elementId: string, geometry: LabelElement["geometry"]) => void
  onOverflow: (overflowing: string[]) => void
}) {
  const surface = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [guides, setGuides] = useState<AlignmentGuide[]>([])

  const drawn = useMemo(
    () => labelSvg({ ...template, elements }, record, { outlines: true }),
    [template, elements, record],
  )

  // ⚠️ Reported upward rather than rendered here: the warning belongs beside the element list, where
  // somebody can act on it, and it must come from the same measurement that did the drawing.
  useEffect(() => {
    onOverflow(drawn.overflowing)
  }, [drawn.overflowing.join(","), onOverflow])

  const millimetresFromEvent = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rectangle = surface.current?.getBoundingClientRect()

      if (!rectangle) {
        return { x: 0, y: 0 }
      }

      return { x: (event.clientX - rectangle.left) / zoom, y: (event.clientY - rectangle.top) / zoom }
    },
    [zoom],
  )

  useEffect(() => {
    if (!drag) {
      return
    }

    function move(event: MouseEvent) {
      const pointer = millimetresFromEvent(event)
      const moved = resized(drag!, pointer)
      const settled = clampToLabel(moved, typeOf(elements, drag!.elementId), template)

      onGeometry(drag!.elementId, settled)

      // ⚠️ Against everything EXCEPT the element being moved — an element is always aligned with itself,
      // and a guide through its own edges would be three lines that never go away.
      setGuides(guidesFor(settled, elements.filter((element) => element.id !== drag!.elementId), template))
    }

    function release() {
      setDrag(null)
      setGuides([])
    }

    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", release)

    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", release)
    }
  }, [drag, elements, template, millimetresFromEvent, onGeometry])

  function beginDrag(event: React.MouseEvent, element: LabelElement, handle: HandleKey | null) {
    event.preventDefault()
    event.stopPropagation()
    onSelect(element.id)

    const pointer = millimetresFromEvent(event)

    setDrag({ elementId: element.id, handle, startX: pointer.x, startY: pointer.y, origin: element.geometry })
  }

  return (
    // ⚠️ **`justify-center` is NOT how a zoomed label is centred.** In a scroll container, centring
    // distributes the overflow to BOTH sides — and `scrollLeft` cannot go negative, so the left edge of
    // a label wider than the pane becomes permanently unreachable. `m-auto` on the child centres it
    // while it fits and lets it start at the origin once it does not, which is the behaviour every
    // image viewer has.
    <div
      className="flex min-h-0 flex-1 overflow-auto bg-muted/40 p-8"
      onMouseDown={() => onSelect(null)}
    >
      <div
        ref={surface}
        className="relative m-auto shadow-sm ring-1 ring-border"
        style={{ width: `${template.widthMm * zoom}px`, height: `${template.heightMm * zoom}px` }}
      >
        {/* ⚠️ White, always — a label prints on a sticker, not on the reader's theme. It is the one
            surface in the product that must NOT follow the palette. */}
        <div className="absolute inset-0 bg-white" dangerouslySetInnerHTML={{ __html: drawn.svg }} />

        {/* Only while something is moving: a permanent grid of these is a screen of lines. */}
        {guides.map((guide) => (
          <span
            key={`${guide.orientation}-${guide.at}`}
            className={
              guide.orientation === "VERTICAL"
                ? "pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
                : "pointer-events-none absolute right-0 left-0 h-px bg-primary"
            }
            style={guide.orientation === "VERTICAL" ? { left: `${guide.at * zoom}px` } : { top: `${guide.at * zoom}px` }}
          />
        ))}

        {elements.map((element) => (
          <div
            key={element.id}
            className={`absolute cursor-move ${
              element.id === selectedId ? "outline outline-2 outline-primary" : "hover:outline hover:outline-primary/40"
            }`}
            style={boxStyle(element, zoom)}
            onMouseDown={(event) => beginDrag(event, element, null)}
          >
            {element.id === selectedId &&
              HANDLES.map((handle) => (
                <span
                  key={handle.key}
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-background bg-primary"
                  style={{
                    left: `${handle.x * 100}%`,
                    top: `${handle.y * 100}%`,
                    cursor: `${handle.key}-resize`,
                  }}
                  onMouseDown={(event) => beginDrag(event, element, handle.key)}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function boxStyle(element: LabelElement, zoom: number): React.CSSProperties {
  const { x, y, width, height, rotation } = element.geometry

  return {
    left: `${x * zoom}px`,
    top: `${y * zoom}px`,
    width: `${width * zoom}px`,
    height: `${height * zoom}px`,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
  }
}

function typeOf(elements: LabelElement[], elementId: string): LabelElement["type"] {
  return elements.find((element) => element.id === elementId)?.type ?? "TEXT"
}

/**
 * Where the rectangle ends up for this pointer position.
 *
 * Moving translates; a handle moves the two edges it owns and leaves the others alone. ⚠️ Clamping to
 * the label and to the type's minimum happens *after* this, in one place — so a handle dragged past the
 * edge stops at the edge instead of producing a design that cannot be saved.
 */
function resized(drag: DragState, pointer: { x: number; y: number }): LabelElement["geometry"] {
  const deltaX = pointer.x - drag.startX
  const deltaY = pointer.y - drag.startY
  const origin = drag.origin

  if (!drag.handle) {
    return { ...origin, x: origin.x + deltaX, y: origin.y + deltaY }
  }

  const holdsWest = drag.handle.includes("w")
  const holdsEast = drag.handle.includes("e")
  const holdsNorth = drag.handle.includes("n")
  const holdsSouth = drag.handle.includes("s")

  return {
    ...origin,
    x: holdsWest ? origin.x + deltaX : origin.x,
    y: holdsNorth ? origin.y + deltaY : origin.y,
    width: holdsWest ? origin.width - deltaX : holdsEast ? origin.width + deltaX : origin.width,
    height: holdsNorth ? origin.height - deltaY : holdsSouth ? origin.height + deltaY : origin.height,
  }
}
