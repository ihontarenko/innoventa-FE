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

  // ⚠️ Seeded from the server and re-seeded whenever it answers again. Keyed on the query's own object
  // rather than on the id, because a save is followed by an invalidation and the fresh answer IS the
  // new baseline — without this, `isDirty` would stay true after a successful write.
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
    isDirty: serialise(config) !== serialise(form?.config ?? {}),
    isSaving: save.isPending,
    save: () => save.mutate(config),
  }
}

/** Order-insensitive: a map with the same pairs in another order is the same configuration. */
function serialise(config: Record<string, string>): string {
  return JSON.stringify(Object.entries(config).sort(([left], [right]) => left.localeCompare(right)))
}
