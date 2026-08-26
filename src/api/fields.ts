import { http } from "./http"
import type { FieldDetail, FieldSummary } from "@/types"

/**
 * A field, and the five surfaces that make one up.
 *
 * ⚠️ **The split into five endpoints is the backend's contract, not an accident of the old screen.**
 * A field's own columns, its option rows, its validation expressions, its attributes and its
 * configuration are replaced independently, and each `PUT` is a *replace* — sending a partial map
 * deletes everything absent from it.
 */
export const fieldsApi = {
  list: () => http.get<FieldSummary[]>("/fields"),

  /** Fields that may be attached to a form — excludes the ones only embeddable inside another. */
  listEligible: () => http.get<FieldSummary[]>("/fields/eligible"),

  listEmbeddable: () => http.get<FieldSummary[]>("/fields/embeddable"),

  get: (fieldId: string) => http.get<FieldDetail>(`/fields/${fieldId}`),

  create: (payload: {
    name: string
    label: string
    icon?: string
    description?: string
    usageType: string
    elementType: string
    unit?: string
    required: boolean
    sortOrder: number
  }) => http.post<FieldDetail>("/fields", payload),

  update: (
    fieldId: string,
    payload: Partial<{
      name: string
      label: string
      icon: string
      description: string
      usageType: string
      elementType: string
      unit: string
      required: boolean
      sortOrder: number
    }>,
  ) => http.put<FieldDetail>(`/fields/${fieldId}`, payload),

  delete: (fieldId: string) => http.delete(`/fields/${fieldId}`),

  /** ⚠️ Replaces the whole list; an option missing from it is deleted. */
  replaceOptions: (fieldId: string, options: Array<{ optionValue: string; optionLabel: string; sortOrder: number }>) =>
    http.put<FieldDetail>(`/fields/${fieldId}/options`, options),

  replaceValidation: (fieldId: string, expressions: string[]) =>
    http.put<FieldDetail>(`/fields/${fieldId}/validation`, expressions),

  replaceAttributes: (fieldId: string, attributes: Record<string, string>) =>
    http.put<FieldDetail>(`/fields/${fieldId}/attributes`, attributes),

  replaceConfigs: (fieldId: string, configs: Record<string, string>) =>
    http.put<FieldDetail>(`/fields/${fieldId}/configs`, configs),

  addChild: (parentFieldId: string, childFieldId: string) =>
    http.post<FieldDetail>(`/fields/${parentFieldId}/children/${childFieldId}`),

  removeChild: (parentFieldId: string, childFieldId: string) =>
    http.delete<FieldDetail>(`/fields/${parentFieldId}/children/${childFieldId}`),

  setChildCondition: (
    parentFieldId: string,
    childFieldId: string,
    condition: { triggerFieldName: string; operator: string; expectedValue: string | null; action: string },
  ) => http.put<FieldDetail>(`/fields/${parentFieldId}/children/${childFieldId}/condition`, condition),

  clearChildCondition: (parentFieldId: string, childFieldId: string) =>
    http.delete(`/fields/${parentFieldId}/children/${childFieldId}/condition`),
}

/**
 * Writing a field.
 *
 * ⚠️ **A field is installation-wide and reusable.** The same "Manufacturer" appears on six forms and is
 * one row — which is why creating one here is not creating it *on* anything, and why deleting one is
 * refused while a form still carries it.
 */
export const fieldWriteApi = {
  create: (payload: {
    name: string
    label: string
    icon?: string
    description?: string
    usageType: string
    elementType: string
    unit?: string
    required: boolean
    sortOrder: number
    options?: { optionValue: string; optionLabel: string; sortOrder: number }[]
    attributes?: Record<string, string>
    validationExpressions?: string[]
  }) => http.post<FieldDetail>("/fields", payload),

  update: (
    fieldId: string,
    payload: Partial<{
      name: string
      label: string
      icon: string
      description: string
      usageType: string
      elementType: string
      unit: string
      required: boolean
      sortOrder: number
    }>,
  ) => http.put<FieldDetail>(`/fields/${fieldId}`, payload),

  delete: (fieldId: string) => http.delete<void>(`/fields/${fieldId}`),
}

/**
 * Tags — a free vocabulary over things that already have a type.
 *
 * ⚠️ **Keyed by `entityKind`, and the kinds do not share a namespace.** A `FIELD` tag called "electrical"
 * and a `FILE` tag of the same name are two rows: merging them would make renaming one rename something
 * on a screen the person renaming it has never opened.
 */
export interface Tag {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export interface TagStats extends Tag {
  /** How many things carry it. ⚠️ A tag nothing carries still exists — it is not an error. */
  count: number
}

/** What one thing carries. ⚠️ `tags` is the whole set — there is no partial answer. */
export interface EntityTags {
  entityId: string
  tags: Tag[]
}

export const tagsApi = {
  listByEntityKind: (entityKind: string) => http.get<Tag[]>("/tags", { params: { entityKind } }),

  getStats: (entityKind: string) => http.get<TagStats[]>("/tags/stats", { params: { entityKind } }),

  getEntityIdsByTag: (tagId: string) => http.get<string[]>("/tags/entities/by-tag", { params: { tagId } }),

  getEntityTags: (entityId: string) => http.get<EntityTags>(`/tags/entities/${entityId}`),

  /**
   * What this thing carries, from now on.
   *
   * ⚠️ **By NAME, and it replaces the whole set.** The backend deletes every assignment and writes the
   * list back, minting any name it has not seen before — so there is no "add one" call to reach for,
   * and a caller that sent only the new tag would drop the rest. Read, then send the whole list.
   *
   * ⚠️ **`entityKind` is not optional and not guessable.** A `FIELD` tag and a `FORM` tag of the same
   * name are two rows; sending the wrong kind files the thing under a vocabulary nobody is looking at.
   */
  setEntityTags: (entityId: string, entityKind: string, tagNames: string[]) =>
    http.put<EntityTags>(`/tags/entities/${entityId}`, { entityKind, tagNames }),
}
