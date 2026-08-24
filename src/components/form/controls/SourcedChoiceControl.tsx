import { useState } from "react"
import { TOMBSTONE_LABEL } from "@/api/optionSources"
import { RecordSelect } from "@/components/RecordSelect"
import { useFieldOptions } from "@/hooks/useOptionSources"
import type { ControlProperties } from "./types"

/**
 * A field whose choices come from a source rather than from typed-in rows.
 *
 * ⚠️ **The widget follows the data.** One page of choices and it is a plain list; more than one and a
 * search box appears and the source filters server-side. Nothing declares which it is — the source
 * returns four rows or fifty thousand and the answer follows.
 *
 * ⚠️ **A stored value that no longer resolves reads as a tombstone, never as the raw value.** It is
 * still the evidence that somebody was chosen, and printing the identifier would be showing a database
 * key to whoever opens the form.
 */
export function SourcedChoiceControl({ field, value, onChange, draftValues = {}, optionLabels = {} }: ControlProperties) {
  const [isOpen, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  // ⚠️ Labels learnt by picking. Once the panel closes the list is gone, and a fresh choice would read
  // as a tombstone until the entry is saved and the server resolves it.
  const [pickedLabels, setPickedLabels] = useState<Record<string, string>>({})

  const multiple = field.elementType === "MULTISELECT" || field.elementType === "CHECKBOXES"
  const { data, isFetching } = useFieldOptions(field.id, search, draftValues, isOpen)

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const selected = value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : []

  // A source that returned everything it has needs no search box; one that paged does.
  const isTypeahead = total > items.length || search !== ""

  function pick(next: string) {
    for (const stored of next.split(",").filter(Boolean)) {
      const found = items.find((item) => item.value === stored)

      if (found) {
        setPickedLabels((previous) => ({ ...previous, [stored]: found.label }))
      }
    }

    onChange(next)
  }

  return (
    <RecordSelect
      value={multiple ? selected : (selected[0] ?? "")}
      options={items}
      multiple={multiple}
      loading={isFetching}
      search={isTypeahead ? search : undefined}
      onSearch={isTypeahead ? setSearch : undefined}
      searchLabel={`Search ${total} choices…`}
      empty={search ? "Nothing matches that search." : "This field has no choices to offer yet."}
      footer={total > items.length ? `Showing ${items.length} of ${total} — type to narrow it down.` : undefined}
      onOpenChange={(next) => {
        setOpen(next)

        if (!next) {
          setSearch("")
        }
      }}
      onChange={pick}
      labelOf={(stored) => pickedLabels[stored] ?? optionLabels[stored] ?? TOMBSTONE_LABEL}
    />
  )
}
