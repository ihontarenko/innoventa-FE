import { useState } from "react"
import { Button } from "@jmouse/ui"
import { LabelPrintDialog } from "@/components/labels/LabelPrintDialog"
import { useLabelTemplatesForForm, useLabelsModule } from "@/hooks/useLabels"
import { useAuthStore } from "@/stores/authStore"

/**
 * The way into printing, from wherever the records are.
 *
 * ⚠️ **One component rather than four**, because all four places ask the same three questions first —
 * *does this workspace print labels at all*, *may this person read these records*, and *is there a
 * design for this form* — and a fourth copy of that trio is the one that gets it wrong.
 *
 * ⚠️ **Absent rather than disabled, on every one of the three.** A switch that removed a menu item and
 * left a button behind would be a promise the settings screen does not keep; a button that opens onto
 * "nothing to print with" is a dead end reached while somebody is holding a box.
 *
 * ⚠️ **Batch is by FILTER, not by selection.** A caller that already knows its ids passes them; a board
 * passes `resolveIds` and its own filter answers the question — which is the filters that already exist
 * plus one button, rather than forty checkboxes.
 */
export function LabelPrintButton({
  formId,
  permission,
  ids,
  resolveIds,
  subject,
  label = "Print labels",
}: {
  /**
   * ⚠️ Everything hangs off this: which designs exist, which are offered, and whether the button is
   * drawn at all. A design lays out one form's fields, so there is no such thing as printing "some
   * records" without knowing which form they are on.
   */
  formId: string | undefined
  /** Reading these records — `custody:read` for a thing, `entry:read` for a record. */
  permission: string
  /** The records, where the caller knows them outright. */
  ids?: string[]
  /** The records, where they come from a filter the caller has to ask the server about. */
  resolveIds?: () => Promise<string[]>
  /** What is being printed, in words — shown before anything happens. */
  subject: string
  label?: string
}) {
  const mayRead = useAuthStore((state) => state.holdsSomewhere(permission))
  const printable = useLabelsModule()
  const { data: designs = [] } = useLabelTemplatesForForm(formId)

  const [isOpen, setOpen] = useState(false)
  const [running, setRunning] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  // ⚠️ After every hook, never before one — an early return above them would change the hook order
  // between renders the moment the module is switched on.
  if (!printable || !mayRead || !formId || designs.length === 0) {
    return null
  }

  async function begin() {
    if (ids) {
      setRunning(ids)
      setOpen(true)

      return
    }

    if (!resolveIds) {
      return
    }

    setBusy(true)

    try {
      setRunning(await resolveIds())
      setOpen(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={busy} onClick={begin}>
        {busy ? "Counting…" : label}
      </Button>

      {isOpen && running && (
        <LabelPrintDialog formId={formId} ids={running} subject={subject} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
