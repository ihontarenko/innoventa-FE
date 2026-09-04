import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { formsApi } from "@/api/forms"
import { useForm } from "@/hooks/useForms"

/**
 * A form's configuration map, held as one draft above every pane that edits part of it.
 *
 * ⚠️ **One draft, one Save, however many panes.** Display, Submitting and Validation are three groups
 * of keys in ONE map that the backend replaces wholesale — a Save per pane would write the map as that
 * pane sees it and silently drop whatever another pane had just changed. So the draft lives above them
 * and the save bar belongs to the screen, not to a group.
 *
 * ⚠️ **A `FormSummary` carries neither `config` nor `fields`**, and both are needed here: the pickers
 * offer the form's own fields. Hence the detail fetch rather than threading it through every caller.
 */
export function useFormConfiguration(formId: string) {
  const queryClient = useQueryClient()
  const { data: form } = useForm(formId)

  const [config, setConfig] = useState<Record<string, string>>({})
  /*
   * ⚠️ **Whether the draft is the server's answer or merely the initial `{}` — and the difference is a
   * form's whole configuration.** The save replaces the map wholesale, so a draft that has not been
   * seeded is not "empty", it is *unknown*, and writing it deletes every key the form holds. That is
   * exactly what happened to the `vr` component type on 2026-09-04: twenty-one keys gone in one second,
   * every voltage regulator in the catalogue left without the `display.primary_field` that names it.
   *
   * `form` being truthy is NOT the same question. A `FormSummary` carries no `config` at all (see the
   * note above), so `form.config ?? {}` reads as an empty configuration for a form that has one — the
   * seeding looks like it happened and the draft is still unknown.
   */
  const [isSeeded, setSeeded] = useState(false)

  // ⚠️ Seeded from the server and re-seeded whenever it answers again. Keyed on the query's own object
  // rather than on the id, because a save is followed by an invalidation and the fresh answer IS the
  // new baseline — without this, `isDirty` would stay true after a successful write.
  useEffect(() => {
    if (form?.config !== undefined) {
      setConfig(form.config)
      setSeeded(true)
    }
  }, [form])

  const save = useMutation({
    /* ⚠️ **The baseline is the SERVER's answer, never the draft.** `replaceConfig` deletes only keys the
       caller demonstrably had; handing it the draft as its own baseline would make that check vacuous
       and hand back the bug it exists to stop. Where the answer carries no config the baseline is empty
       and nothing is deleted at all — which is exactly right, because then nothing was ever read. */
    mutationFn: (next: Record<string, string>) => formsApi.replaceConfig(formId, next, form?.config ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      queryClient.invalidateQueries({ queryKey: ["forms", formId] })
    },
  })

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

  return {
    form,
    config,
    setConfig,
    setValue,
    /* ⚠️ Nothing is dirty before the draft is the server's — otherwise the Save button offers to write
       a map nobody has read, which is the whole failure this guard exists for. */
    isDirty: isSeeded && serialise(config) !== serialise(form?.config ?? {}),
    isSaving: save.isPending,
    save: () => {
      if (isSeeded) {
        save.mutate(config)
      }
    },
  }
}

/** Order-insensitive: a map with the same pairs in another order is the same configuration. */
function serialise(config: Record<string, string>): string {
  return JSON.stringify(Object.entries(config).sort(([left], [right]) => left.localeCompare(right)))
}
