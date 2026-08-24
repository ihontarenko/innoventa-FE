import { useState } from "react"
import { Badge, Input, Label, Textarea } from "@jmouse/ui"

/**
 * The one thing the old landing never showed: **the same engine wearing three different shapes.**
 *
 * ⚠️ **Eight cards of prose could not say this, and that is why they were eight cards.** "Custom field
 * schemas — text, number, dropdown, rating, file, image, tags, colour, composite value and 20+ more
 * element types" is a sentence somebody skims. Three tabs where the form visibly becomes a different
 * form is the same claim, made in one press, and it is the whole product.
 *
 * ⚠️ **It is an illustration, and it is drawn with the real primitives.** These are `@jmouse/ui`'s own
 * `Input`, `Label` and `Badge` — the identical parts the actual form engine renders — so the picture
 * cannot drift away from the product the way a screenshot in a marketing folder does. What it does not
 * do is talk to a server: this is the page a stranger loads, and it must paint with the backend down.
 */
interface DemoField {
  label: string
  type: string
  /** What the reader sees typed in. Nothing here is editable — it is a picture, not a form. */
  value: string
  unit?: string
  control?: "text" | "textarea" | "swatch" | "tags"
  hint?: string
}

interface DemoShape {
  key: string
  tab: string
  what: string
  /** The subject area a workspace like this would be set to. */
  area: string
  fields: DemoField[]
}

const SHAPES: DemoShape[] = [
  {
    key: "resistor",
    tab: "Resistors",
    what: "A drawer of passives, counted down to the last one.",
    area: "Radio components and electronics",
    fields: [
      { label: "Part number", type: "TEXT", value: "RC0805FR-0710KL" },
      { label: "Resistance", type: "SIMPLE_COMPOSITE", value: "10k", unit: "Ω", hint: "Written as engineers write it — 10k, 4k7, 1M2." },
      { label: "Tolerance", type: "SELECT", value: "±1 %" },
      { label: "Package", type: "SELECT", value: "0805" },
      { label: "Quantity", type: "NUMBER", value: "312", unit: "pcs" },
      { label: "Reorder below", type: "NUMBER", value: "50", unit: "pcs" },
      { label: "Datasheet", type: "FILE", value: "yageo-rc0805.pdf" },
    ],
  },
  {
    key: "sample",
    tab: "Lab samples",
    what: "The same engine, counting something that has never seen a soldering iron.",
    area: "General",
    fields: [
      { label: "Sample ID", type: "TEXT", value: "S-2026-0418" },
      { label: "Collected", type: "DATE", value: "2026-04-18" },
      { label: "Matrix", type: "SELECT", value: "Soil" },
      { label: "pH", type: "NUMBER", value: "6.4" },
      { label: "Storage", type: "SELECT", value: "−20 °C freezer" },
      { label: "Hazard", type: "COLOR", value: "#e0b400", control: "swatch" },
      { label: "Notes", type: "TEXTAREA", value: "Duplicate of S-2026-0417, split on arrival.", control: "textarea" },
    ],
  },
  {
    key: "equipment",
    tab: "Loan equipment",
    what: "Things that leave the building and are supposed to come back.",
    area: "General",
    fields: [
      { label: "Asset tag", type: "TEXT", value: "OSC-014" },
      { label: "Model", type: "TEXT", value: "Rigol DS1054Z" },
      { label: "Condition", type: "RATING", value: "★★★★☆" },
      { label: "Held by", type: "SELECT", value: "Anna K." },
      { label: "Due back", type: "DATE", value: "2026-09-02" },
      { label: "Labels", type: "TAGS", value: "calibrated · fragile", control: "tags" },
      { label: "Location", type: "SELECT", value: "Bench 3 · Shelf B" },
    ],
  },
]

export function ShapeDemo() {
  const [active, setActive] = useState(SHAPES[0].key)
  const shape = SHAPES.find((one) => one.key === active) ?? SHAPES[0]

  return (
    <section id="shape" className="border-b bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">How it fits</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">One engine, your shape</h2>
          <p className="text-muted-foreground">
            Nothing below is a different product, a different plan or a different install. It is one form
            engine, told three different things about what it is counting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="What a workspace counts">
          {SHAPES.map((one) => (
            <button
              key={one.key}
              role="tab"
              aria-selected={one.key === active}
              onClick={() => setActive(one.key)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                one.key === active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {one.tab}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="flex flex-col gap-4">
            <p className="text-lg">{shape.what}</p>

            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Subject area</dt>
                <dd>{shape.area}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Fields declared</dt>
                <dd>{shape.fields.length}</dd>
              </div>
            </dl>

            <p className="text-sm text-muted-foreground">
              ⚠️ The same declaration also produces the inventory table, the parametric search, the public
              link and the embed. You describe the thing once.
            </p>
          </div>

          {/* ⚠️ Keyed on the shape so React remounts rather than reconciles: switching tabs should read
              as a different form arriving, not as seven labels quietly changing their text. */}
          <div key={shape.key} className="flex flex-col gap-3 rounded-lg border bg-background p-5">
            {shape.fields.map((field) => (
              <DemoRow key={field.label} field={field} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DemoRow({ field }: { field: DemoField }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <Label className="text-xs">{field.label}</Label>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {field.type}
        </Badge>
      </div>

      {field.control === "textarea" ? (
        <Textarea readOnly rows={2} value={field.value} className="pointer-events-none text-sm" />
      ) : field.control === "swatch" ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span aria-hidden="true" className="size-4 rounded" style={{ background: field.value }} />
          <code className="font-mono text-xs">{field.value}</code>
        </div>
      ) : field.control === "tags" ? (
        <div className="flex flex-wrap gap-1.5">
          {field.value.split("·").map((tag) => (
            <Badge key={tag} variant="outline">
              {tag.trim()}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="relative">
          <Input readOnly value={field.value} className="pointer-events-none text-sm" />
          {field.unit && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
              {field.unit}
            </span>
          )}
        </div>
      )}

      {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
    </div>
  )
}
