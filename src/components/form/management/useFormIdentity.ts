import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { formsApi } from "@/api/forms"
import type { FormAudience, FormStatus } from "@/types"
import type { ManagedForm } from "./types"

/**
 * What the form is called and who may reach it, held as one draft.
 *
 * ⚠️ **One draft behind TWO panes, and that is not tidiness.** Identity and Reach write through the
 * same `PUT /forms/{id}` — a pane that sent only its own half would blank the other's fields on the way
 * past. So the draft holds all six, and either pane's Save writes all six.
 *
 * ⚠️ **Reseeded from the form's identity, not from the object.** The query refetches and hands over a
 * new `form` with the same content; reseeding on that would wipe what somebody is typing.
 */
export interface FormIdentityDraft {
  name: string
  codename: string
  icon: string
  description: string
  status: FormStatus
  audience: FormAudience
}

function draftOf(form: ManagedForm): FormIdentityDraft {
  return {
    name: form.name,
    codename: form.codename ?? "",
    icon: form.icon ?? "",
    description: form.description ?? "",
    status: form.status,
    audience: form.audience,
  }
}

export function useFormIdentity(form: ManagedForm) {
  const queryClient = useQueryClient()

  const [original, setOriginal] = useState<FormIdentityDraft>(() => draftOf(form))
  const [draft, setDraft] = useState<FormIdentityDraft>(() => draftOf(form))

  useEffect(() => {
    setOriginal(draftOf(form))
    setDraft(draftOf(form))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id])

  const save = useMutation({
    mutationFn: () => formsApi.update(form.id, draft),
    onSuccess: () => {
      setOriginal(draft)
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      queryClient.invalidateQueries({ queryKey: ["forms", form.id] })
    },
  })

  function update(patch: Partial<FormIdentityDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  return {
    draft,
    update,
    isDirty: JSON.stringify(draft) !== JSON.stringify(original),
    isSaving: save.isPending,
    error: save.isError ? "Could not save. Nothing was lost — try again." : null,
    save: () => save.mutate(),
  }
}
