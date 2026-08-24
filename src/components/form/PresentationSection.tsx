import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@jmouse/ui"
import { formsApi } from "@/api/forms"
import { ConfigControl } from "@/components/form/builder/ConfigControl"
import { EditorField, EditorSection } from "@/components/form/builder/EditorSection"
import { RawConfigDialog } from "@/components/form/RawConfigDialog"
import { useForm } from "@/hooks/useForms"
import { FORM_CONFIG_GROUPS } from "@/lib/formConfigCatalogue"

/**
 * How an entry of this form is summarised, wherever it is listed.
 *
 * ⚠️ **Only the `form`-scoped groups, and that boundary is the point.** A title field and a set of
 * highlighted fields are true of *any* form whatever a workspace counts — a lab sample has a name and
 * two facts worth leading with, exactly as a resistor does. `stock.*` and `pricing.*` are not: they
 * presume a thing you have a number of, and a distributor. Showing them here would put a subject area's
 * vocabulary on a screen that belongs to the form engine, which is the crossing `LevelDoor`
 * (`INVT-0076`) exists to stop. The split is data — `ConfigGroup.scope` — not a list written here.
 *
 * ⚠️ **The builder still shows everything**, because a builder is already inside one workspace and one
 * subject area. This is the library, which is not.
 *
 * ⚠️ **A `FormSummary` does not carry `config` or `fields`**, and both are needed — the pickers offer
 * this form's own fields. So the detail is fetched here rather than threaded through every caller.
 */
export function PresentationSection({ formId }: { formId: string }) {
  const queryClient = useQueryClient()
  const { data: form } = useForm(formId)

  const [config, setConfig] = useState<Record<string, string>>({})
  const [isRawOpen, setRawOpen] = useState(false)

  // ⚠️ Seeded from the server and re-seeded whenever it answers again — but never while a save is in
  // flight, or the response would overwrite what somebody typed in the meantime.
  useEffect(() => {
    if (form) {
      setConfig(form.config ?? {})
    }
  }, [form])

  const save = useMutation({
    mutationFn: (next: Record<string, string>) => formsApi.replaceConfig(formId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      queryClient.invalidateQueries({ queryKey: ["forms", formId] })
    },
  })

  if (!form) {
    return null
  }

  const groups = FORM_CONFIG_GROUPS.filter((group) => group.scope === "form")
  const isDirty = serialise(config) !== serialise(form.config ?? {})

  function setValue(key: string, value: string) {
    setConfig((current) => {
      const next = { ...current }

      // ⚠️ Cleared means ABSENT, not empty. An empty string is a value the backend would honour, and
      // "the title field is the empty string" is not a thing anybody means.
      if (value) {
        next[key] = value
      } else {
        delete next[key]
      }

      return next
    })
  }

  return (
    <>
      {groups.map((group) => {
        const setCount = group.entries.filter((entry) => config[entry.key]).length

        return (
          <EditorSection
            key={group.title}
            title={group.title}
            hint={group.hint}
            badge={setCount || undefined}
            defaultOpen={group.title === "Display"}
          >
            {group.entries.map((entry) => (
              <EditorField key={entry.key} label={entry.label} hint={entry.hint}>
                <ConfigControl
                  entry={entry}
                  value={config[entry.key] ?? ""}
                  fields={form.fields}
                  onChange={(value) => setValue(entry.key, value)}
                />
              </EditorField>
            ))}
          </EditorSection>
        )
      })}

      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => setRawOpen(true)}>
          Raw edit
        </Button>

        <span className="ml-auto text-xs text-muted-foreground">
          {save.isPending ? "Saving…" : isDirty ? "unsaved" : "saved"}
        </span>

        <Button size="sm" disabled={!isDirty || save.isPending} onClick={() => save.mutate(config)}>
          Save
        </Button>
      </div>

      {isRawOpen && (
        <RawConfigDialog
          config={config}
          // ⚠️ Applied into the draft, not saved — the dialog edits what is on screen, and Save is still
          // the one thing that writes. Otherwise a paste would commit before anybody had read it.
          onApply={setConfig}
          onClose={() => setRawOpen(false)}
        />
      )}
    </>
  )
}

function serialise(config: Record<string, string>): string {
  return JSON.stringify(Object.entries(config).sort(([left], [right]) => left.localeCompare(right)))
}
