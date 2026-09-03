import { useState } from "react"
import { RecordPicker, type RecordPickerItem } from "@jmouse/ui"
import { TOMBSTONE_LABEL } from "@/api/optionSources"
import { useFieldOptions } from "@/hooks/useOptionSources"
import type { ControlProperties } from "./types"

/**
 * A field whose choices come from a source rather than from typed-in rows.
 *
 * <h2>⚠️ A picker, not a dropdown — and for every sourced field, not only for parts</h2>
 *
 * <p>Ivan asked for it on the part field first (`INVT-319`, item 1): *«А можемо взагалі не мати цих двох
 * селектів. Замість цього, кнопка вибрати парт, відкривається нове модальне вікно з парт пікером»*. What
 * makes it right there makes it right everywhere a source answers: a select is a control for six options
 * somebody already knows, and a source returns a catalogue. Past that size the list has to be searched
 * and read before it can be chosen from, and a dropdown gives room for neither.
 *
 * <p>⚠️ <strong>So there is one picker, in `@jmouse/ui`, and this is its wiring.</strong> Building a part
 * picker here and generalising it later is how these three interfaces already came to hold twelve
 * duplicated names — the shared thing goes into the library first, and the product supplies what only it
 * knows: which source to ask, and how a stored identifier reads.
 *
 * <h2>⚠️ A stored value that no longer resolves reads as a tombstone, never as the raw value</h2>
 *
 * <p>It is still the evidence that something was chosen, and printing the identifier would put a
 * database key on the trigger — which is exactly what `INVT-0305` and `INVT-329` were both about.
 *
 * <h2>⚠️ The search box follows the data</h2>
 *
 * <p>One page of choices and there is nothing to search; more than one and the source filters
 * server-side. Nothing declares which — the source returns four rows or fifty thousand and the control
 * follows.
 */
export function SourcedChoiceControl({
  field,
  value,
  onChange,
  draftValues = {},
  optionLabels = {},
}: ControlProperties) {
  const [search, setSearch] = useState("")

  /**
   * ⚠️ **Labels learnt by picking.** The options are fetched while the dialog is open and gone when it
   * closes, so a fresh choice would read as a tombstone until the entry is saved and the server resolves
   * it — the trigger would say *‹deleted›* about the thing somebody had just chosen.
   */
  const [pickedLabels, setPickedLabels] = useState<Record<string, string>>({})

  const multiple = field.elementType === "MULTISELECT" || field.elementType === "CHECKBOXES"

  /**
   * ⚠️ **Fetched whenever the field is on screen, not only while the dialog is open.**
   *
   * <p>The dropdown could wait for its own open because it *was* the list. A picker's trigger has to
   * print the chosen record's name before anybody opens anything, and the only place that name comes
   * from is this answer.
   */
  const { data, isFetching } = useFieldOptions(field.id, search, draftValues, true)

  const options = data?.items ?? []
  const total = data?.total ?? 0

  const items: RecordPickerItem[] = options.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  // A source that returned everything it has needs no search box; one that paged does.
  const searchable = total > options.length || search !== ""

  function pick(next: string) {
    for (const stored of next.split(",").filter(Boolean)) {
      const found = options.find((option) => option.value === stored)

      if (found) {
        setPickedLabels((previous) => ({ ...previous, [stored]: found.label }))
      }
    }

    onChange(next)
  }

  return (
    <RecordPicker
      value={value ?? ""}
      items={items}
      multiple={multiple}
      loading={isFetching}
      title={field.label || field.name}
      description={field.description ?? undefined}
      triggerLabel={`Choose ${(field.label || field.name).toLowerCase()}…`}
      search={searchable ? search : undefined}
      onSearch={searchable ? setSearch : undefined}
      searchLabel={`Search ${total} choices…`}
      empty={{
        title: search ? "Nothing matches" : "Nothing to choose from",
        text: search
          ? "Try a shorter search — this list is narrowed on the server."
          : "This field's source has nothing to offer yet.",
      }}
      footer={
        total > options.length
          ? `Showing ${options.length} of ${total} — type to narrow it down.`
          : undefined
      }
      labelOf={(stored) => pickedLabels[stored] ?? optionLabels[stored] ?? TOMBSTONE_LABEL}
      onChange={pick}
    />
  )
}
