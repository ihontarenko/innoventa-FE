import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@jmouse/ui"
import type { FieldDetail, FormEntry } from "@/types/forms"
import type { useOfflineQueue } from "@/lib/offline/useOfflineQueue"
import { FieldControl } from "@/pages/station/components/AddComponent"

export interface EditComponentProperties {
  entry: FormEntry
  formId: string
  spaceId: string
  fields: FieldDetail[]
  countFieldName?: string
  imageFieldName?: string
  queue: ReturnType<typeof useOfflineQueue>
  onDone: () => void
}

/**
 * Editing everything else about a component, from the station.
 *
 * <h2>⚠️ Why this exists, having been argued against</h2>
 *
 * <p>The station shipped read-only below the counter, on the reasoning that anything past a count
 * belongs on the desktop. Ivan's answer was the right one: <em>"how do I edit the rest, and what is the
 * point of the application then?"</em> — somebody standing at a shelf with the part in their hand is
 * the person best placed to fix its storage location, its vendor or its notes, and telling them to
 * remember it until they are back at a desk is how a stock record stays wrong.
 *
 * <p>So the line moved. It is not <em>"a station shows and the desktop edits"</em>; it is <em>"a station
 * edits values and the desktop designs forms"</em>. Nothing here creates a field, changes a rule or
 * touches a form — it fills in the boxes that already exist.
 *
 * <h2>⚠️ It goes through the offline queue as a `set`, which is what that kind was for</h2>
 *
 * <p>A whole-entry edit is **absolute**, unlike a count adjustment, and ADR 23 says why: there is no
 * composing two people rewriting the same text, and it is the rarer act by a wide margin. That kind
 * existed in the queue from the first day and had no caller until now.
 *
 * <p>Which means editing works with no signal, and the count on the same screen still composes with
 * anybody else's — the two behave differently on purpose and both are correct.
 *
 * <h2>⚠️ The count and the photograph are deliberately absent from this form</h2>
 *
 * <p>Both already have a control of their own above it, and both are queued differently — a delta and
 * a blob. Offering a second way to type a count in would produce two paths that disagree the first time
 * somebody used them in the same minute.
 */
export function EditComponent({
  entry,
  formId,
  spaceId,
  fields,
  countFieldName,
  imageFieldName,
  queue,
  onDone,
}: EditComponentProperties) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...entry.fieldValues }))
  const [saving, setSaving] = useState(false)

  const editable = fields.filter(
    (field) =>
      field.status === "ACTIVE"
      && field.usageType !== "PHANTOM"
      && field.name !== countFieldName
      && field.name !== imageFieldName,
  )

  const changed = editable.some((field) => (values[field.name] ?? "") !== (entry.fieldValues[field.name] ?? ""))

  const save = async () => {
    setSaving(true)

    try {
      // ⚠️ The WHOLE map, not the difference. The entry endpoint replaces what it is given, so sending
      // only what changed would blank everything else — and the queue replays this verbatim, possibly
      // days later, when "the difference" no longer means anything.
      await queue.enqueue({ kind: "set", spaceId, formId, entryId: entry.id, fieldValues: values })
      await queryClient.invalidateQueries({ queryKey: ["station", "components"] })

      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {editable.map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          value={values[field.name] ?? ""}
          onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
        />
      ))}

      {!queue.online && (
        <p className="text-muted-foreground text-[12px] leading-relaxed">
          No signal — this will be kept and sent when there is one.
        </p>
      )}

      <div
        className="bg-background sticky bottom-0 flex gap-2 py-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <Button variant="outline" className="h-11 flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button className="h-11 flex-1" disabled={saving || !changed} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </div>
  )
}
