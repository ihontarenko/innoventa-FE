import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { fieldsApi } from "@/api/fields"
import type { ChoiceOption } from "@/lib/fieldOptions"
import type { ElementType, FieldDetail, UsageType } from "@/types"

/**
 * One field being edited, held as **one** value.
 *
 * ⚠️ **This is the fix for the worst thing about the old editor.** There, `placeholder` and `style`
 * were typed inputs *and* lines inside a raw attributes textarea, kept in step by hand — two spellings
 * of one fact, and the day they disagreed the field saved from whichever was wrong. Here the attribute
 * map is the only state; a typed control is a **view** over one of its keys, and the raw editor is a
 * view over all of them. There is nothing to keep in step.
 *
 * ⚠️ **And it knows which of the five surfaces actually changed**, so saving sends only those. A field
 * whose label was corrected does not rewrite its options, its validation and its configuration on the
 * way past — each of those is a *replace*, and replacing something with itself is a write that can fail
 * for reasons the reader did not cause.
 */
export interface FieldDraft {
  label: string
  icon: string
  description: string
  usageType: UsageType
  elementType: ElementType
  unit: string
  required: boolean
  options: ChoiceOption[]
  validation: string[]
  attributes: Record<string, string>
  configs: Record<string, string>
}

export type FieldSurface = "field" | "options" | "validation" | "attributes" | "configs"

function draftOf(detail: FieldDetail): FieldDraft {
  return {
    label: detail.label,
    icon: detail.icon ?? "",
    description: detail.description ?? "",
    usageType: detail.usageType,
    elementType: detail.elementType,
    unit: detail.unit ?? "",
    required: detail.required,
    options: detail.options
      .slice()
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((option) => ({ value: option.optionValue, label: option.optionLabel })),
    validation: [...detail.validationExpressions],
    attributes: { ...detail.attributes },
    configs: { ...detail.configs },
  }
}

/** ⚠️ Order-insensitive for maps, order-SENSITIVE for lists — an option's position is its sort order. */
function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * The identifier a field is addressed by in an entry, derived from its label the way the backend
 * derives it. Shown read-only, because renaming it would orphan every value already stored under it.
 */
export function toSnakeCase(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function useFieldDraft(detail: FieldDetail) {
  const queryClient = useQueryClient()
  const [original, setOriginal] = useState<FieldDraft>(() => draftOf(detail))
  const [draft, setDraft] = useState<FieldDraft>(() => draftOf(detail))
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ⚠️ Keyed by the field's identity, not by the object: the query refetches and hands over a new
  // `detail` with the same content, and reseeding on that would wipe what somebody is typing.
  useEffect(() => {
    setOriginal(draftOf(detail))
    setDraft(draftOf(detail))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id])

  const dirtySurfaces = useMemo(() => {
    const dirty = new Set<FieldSurface>()

    const fieldColumnsChanged =
      draft.label !== original.label ||
      draft.icon !== original.icon ||
      draft.description !== original.description ||
      draft.usageType !== original.usageType ||
      draft.elementType !== original.elementType ||
      draft.unit !== original.unit ||
      draft.required !== original.required

    if (fieldColumnsChanged) {
      dirty.add("field")
    }

    if (!sameValue(draft.options, original.options)) {
      dirty.add("options")
    }

    if (!sameValue(draft.validation, original.validation)) {
      dirty.add("validation")
    }

    if (!sameValue(draft.attributes, original.attributes)) {
      dirty.add("attributes")
    }

    if (!sameValue(draft.configs, original.configs)) {
      dirty.add("configs")
    }

    return dirty
  }, [draft, original])

  function update(patch: Partial<FieldDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  /** A typed control over one attribute key. Setting it blank removes the key rather than storing "". */
  function setAttribute(key: string, value: string) {
    setDraft((previous) => {
      const attributes = { ...previous.attributes }

      if (value.trim()) {
        attributes[key] = value
      } else {
        delete attributes[key]
      }

      return { ...previous, attributes }
    })
  }

  function setConfig(key: string, value: string) {
    setDraft((previous) => {
      const configs = { ...previous.configs }

      if (value.trim()) {
        configs[key] = value
      } else {
        delete configs[key]
      }

      return { ...previous, configs }
    })
  }

  function revert() {
    setDraft(original)
    setError(null)
  }

  async function save() {
    if (dirtySurfaces.size === 0) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      // ⚠️ The field's own columns go first. `elementType` decides which of the other surfaces even
      // mean anything, so writing options for a type the server has not been told about yet is how a
      // half-applied save leaves a field nobody can render.
      if (dirtySurfaces.has("field")) {
        await fieldsApi.update(detail.id, {
          label: draft.label,
          icon: draft.icon,
          description: draft.description,
          usageType: draft.usageType,
          elementType: draft.elementType,
          unit: draft.unit,
          required: draft.required,
        })
      }

      if (dirtySurfaces.has("options")) {
        await fieldsApi.replaceOptions(
          detail.id,
          draft.options.map((option, index) => ({
            optionValue: option.value,
            optionLabel: option.label || option.value,
            sortOrder: index,
          })),
        )
      }

      if (dirtySurfaces.has("validation")) {
        await fieldsApi.replaceValidation(
          detail.id,
          draft.validation.map((expression) => expression.trim()).filter(Boolean),
        )
      }

      if (dirtySurfaces.has("attributes")) {
        await fieldsApi.replaceAttributes(detail.id, draft.attributes)
      }

      if (dirtySurfaces.has("configs")) {
        await fieldsApi.replaceConfigs(detail.id, draft.configs)
      }

      setOriginal(draft)
      await queryClient.invalidateQueries({ queryKey: ["fields", detail.id] })
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
    } catch {
      // ⚠️ The draft is deliberately NOT reverted on failure: whatever was typed is still the reader's
      // work, and throwing it away to "return to a clean state" is the one thing they cannot undo.
      setError("Could not save this field. Nothing was lost — try again.")
    } finally {
      setSaving(false)
    }
  }

  return {
    draft,
    update,
    setAttribute,
    setConfig,
    dirtySurfaces,
    isDirty: dirtySurfaces.size > 0,
    isSaving,
    error,
    revert,
    save,
    derivedName: toSnakeCase(draft.label) || detail.name,
  }
}
