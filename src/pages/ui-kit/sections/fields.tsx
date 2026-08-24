import { useState } from "react"
import { Calendar, Input, Label, Textarea } from "@jmouse/ui"
import { RecordSelect } from "@/components/RecordSelect"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import type { KitSection } from "../Specimen"

/** Everything typed into or chosen from. */

const RECORDS = [
  { value: "sp-1", label: "Hobby & DIY Workshop", hint: "hobby-workshop" },
  { value: "sp-2", label: "Learning Lab", hint: "learning-lab" },
  { value: "sp-3", label: "Internal", hint: "internal" },
]

function RecordSelectSpecimen() {
  const [value, setValue] = useState("sp-1")
  const [search, setSearch] = useState("")

  return (
    <div className="w-72">
      <RecordSelect
        value={value}
        options={RECORDS.filter((record) => record.label.toLowerCase().includes(search.toLowerCase()))}
        search={search}
        onSearch={setSearch}
        searchLabel="a name or a slug"
        onChange={setValue}
        labelOf={(stored) => RECORDS.find((record) => record.value === stored)?.label ?? stored}
      />
    </div>
  )
}

function FieldSpecimen() {
  const [value, setValue] = useState("")

  return (
    <div className="flex w-full flex-wrap gap-4">
      <label className="flex w-64 flex-col gap-1">
        <span className="text-xs font-medium">With a label</span>
        <Input className="h-8 text-sm" value={value} placeholder="Type…" onChange={(event) => setValue(event.target.value)} />
        <span className="text-[11px] text-muted-foreground">The sentence that says why it is here.</span>
      </label>

      <label className="flex w-48 flex-col gap-1">
        <span className="text-xs font-medium">Mono</span>
        <Input className="h-8 font-mono text-sm" defaultValue="entry:write" />
      </label>

      <label className="flex w-40 flex-col gap-1">
        <span className="text-xs font-medium">Disabled</span>
        <Input className="h-8 text-sm" value="not yours to change" disabled onChange={() => undefined} />
      </label>
    </div>
  )
}

export const fieldsSection: KitSection = {
  key: "fields",
  label: "Поля",
  about: "Everything typed into or chosen from — and which control a set of choices earns.",
  specimens: [
    {
      name: "field",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Input",
      what: "A label above, the control, and one line of why underneath.",
      note: (
        <>
          ⚠️ <strong>A disabled box says “not yours to change”.</strong> An enabled one that discards what was typed
          says the product is broken — a fact nobody can edit is shown as a fact, not as a dead field.
        </>
      ),
      render: () => <FieldSpecimen />,
    },
    {
      name: "textarea",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Textarea",
      what: "Prose, or a document. Monospaced wherever what goes in it is code.",
      render: () => (
        <Textarea className="min-h-24 w-full font-mono text-xs" defaultValue={"role SPACE_ADMIN {\n  entry:write @SPACE\n}"} />
      ),
    },
    {
      name: "select",
      origin: "product",
      from: "src/components/access/PolicyEditingKit.tsx",
      symbol: "PlainSelect",
      what: "The browser's own listbox, painted like everything else.",
      note: (
        <>
          ⚠️ <strong>This, not the Radix select, wherever a list is long or a row is short.</strong> Seventy
          permissions with a sentence each need type-to-find and must not reflow the row they sit in.
        </>
      ),
      render: () => (
        <div className="w-64">
          <PlainSelect value="ALLOW" onChange={() => undefined}>
            <option value="ALLOW">allow</option>
            <option value="DENY">deny — wins</option>
          </PlainSelect>
        </div>
      ),
    },
    {
      name: "record-select",
      origin: "product",
      from: "src/components/RecordSelect.tsx",
      symbol: "RecordSelect",
      what: "Choosing a record out of many — one, or several — with a typeahead and a hint per row.",
      note: "For anything bounded by how big the customer is: a workspace, a person, an account. Not for an enum.",
      render: () => <RecordSelectSpecimen />,
    },
    {
      name: "label",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Label",
      what: "The primitive behind a field's own label, where a control cannot be wrapped in one.",
      render: () => (
        <div className="flex items-center gap-2">
          <Label htmlFor="kit-label-example">Bound label</Label>
          <Input id="kit-label-example" className="h-8 w-40 text-sm" defaultValue="…" />
        </div>
      ),
    },
    {
      name: "calendar",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Calendar",
      what: "A month, for picking a day. A bare `type=\"date\"` field is right almost everywhere else.",
      note: "⚠️ Reach for it only where somebody is choosing *around* a date — a range, a busy month. One date is a field.",
      render: () => <Calendar mode="single" className="rounded-md border" />,
    },
  ],
}
