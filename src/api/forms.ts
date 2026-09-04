import { http } from "./http"
import type {
  FieldCondition,
  FormAudience,
  FormCategory,
  FormDetail,
  FormEntry,
  FormPurpose,
  FormSummary,
  IdentityStrategy,
  SubmissionPolicy,
} from "@/types"

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export const formsApi = {
  list: (page = 0, size = 20) => http.get<Page<FormSummary>>("/forms", { params: { page, size } }),

  get: (formId: string) => http.get<FormDetail>(`/forms/${formId}`),

  update: (
    formId: string,
    payload: Partial<{
      name: string
      codename: string
      description: string
      icon: string
      status: string
      audience: string
      categoryId: string
    }>,
  ) => http.put<FormDetail>(`/forms/${formId}`, payload),

  attachField: (formId: string, fieldId: string) => http.post<FormDetail>(`/forms/${formId}/fields/${fieldId}`),

  detachField: (formId: string, fieldId: string) => http.delete<FormDetail>(`/forms/${formId}/fields/${fieldId}`),

  /**
   * ⚠️ **One step at a time — there is no "put it at index N".** The endpoint takes a direction, so
   * dragging a field four places means four calls. `useMoveFieldTo` is where that is turned into one
   * gesture; a `PUT …/position` would collapse it, and that is a backend change nobody has asked for
   * yet.
   */
  moveField: (formId: string, fieldId: string, direction: 1 | -1) =>
    http.put<FormDetail>(`/forms/${formId}/fields/${fieldId}/move`, { direction }),

  setFieldCondition: (formId: string, fieldId: string, condition: FieldCondition) =>
    http.put<FormDetail>(`/forms/${formId}/fields/${fieldId}/condition`, condition),

  clearFieldCondition: (formId: string, fieldId: string) =>
    http.delete(`/forms/${formId}/fields/${fieldId}/condition`),

  getConfig: (formId: string) => http.get<Record<string, string>>(`/forms/${formId}/config`),

  setConfigValues: (formId: string, values: Record<string, string>) =>
    http.put<Array<{ key: string; value: string }>>(`/forms/${formId}/config`, { values }),

  clearConfigValue: (formId: string, key: string) => http.delete(`/forms/${formId}/config/${key}`),

  /**
   * Make the stored configuration equal to this map — including what is no longer in it.
   *
   * ⚠️ **`setConfigValues` alone does NOT delete, and every editor here promised that it did.** The raw
   * text box says "anything missing from here is deleted on save"; the call underneath only writes the
   * keys it is given, so a line somebody removed came straight back on the next read. The failure is
   * silent and looks like the editor ignoring the edit — which is worse than an error, because the
   * obvious next move is to remove the line again.
   *
   * ⚠️ **Deletions go first.** A key being replaced by nothing and a key being replaced by a value are
   * the same intent; clearing afterwards would race a write of the same key.
   */
  replaceConfig: async (
    formId: string,
    next: Record<string, string>,
    /**
     * What the caller was holding when the reader started editing — the server's own answer, not the
     * draft. ⚠️ **Required, and it is the entire safety mechanism.** See below.
     */
    baseline: Record<string, string>,
  ) => {
    const current = await formsApi.getConfig(formId).then((response) => response.data)

    /*
     * ⚠️ **A CALLER MAY ONLY DELETE A KEY IT ACTUALLY HAD.**
     *
     * A key stored on the form that is in neither the draft nor the baseline is not *absent from the
     * save* — it is **unknown to the caller**, and unknown must never mean delete. That distinction is
     * the whole fix, and it is exact rather than a heuristic about how many keys look like too many.
     *
     * ⚠️ **This is not defensive decoration — it happened twice in twenty minutes.** On 2026-09-04 the
     * `vr` component type lost all twenty-one of its keys — `display.primary_field`,
     * `display.secondary_field`, every catalogue mapping, its validation document — and then lost them
     * again after being restored. The audit trail both times is twenty `deleteConfiguration` events
     * **under twenty separate operation ids** plus one `setConfiguration` carrying a single key: twenty
     * one HTTP requests, which is this function and nothing else in the interface.
     *
     * The consequence was not subtle. A record is called by `display.primary_field`, so every voltage
     * regulator in the catalogue and every position holding one lost its name. Ivan: *«в інвентарі чому
     * не тянуться правильні назви????»*, and after the restore, *«оновив картинку і знову затерлись всі
     * конфіги»*.
     *
     * ⚠️ **Refusing an EMPTY draft was the first attempt and it was not enough**, which is why the rule
     * is now about provenance rather than about size: the draft was not empty, it held exactly one key,
     * and one key is a perfectly ordinary save. What was wrong with it was never its size — it was that
     * it had never been seeded, so its silence about twenty keys was ignorance rather than intent.
     *
     * A caller that really does mean to remove keys — the raw editor, where the text IS the
     * configuration — passes the seeded map as `baseline` and its removals go through as they always
     * did.
     */
    const unknown = Object.keys(current).filter((key) => !(key in next) && !(key in baseline))
    const removed = Object.keys(current).filter((key) => !(key in next) && key in baseline)

    if (unknown.length > 0) {
      /* Left alone rather than thrown on: the write the reader asked for is legitimate and goes
         through. Logged because a caller passing a baseline it did not seed is a bug in that caller,
         and it is otherwise completely silent. */
      console.warn(
        `[forms] keeping ${unknown.length} configuration key(s) of ${formId} that this save never saw: ` +
          `${unknown.join(", ")}. A key absent from an unseeded draft is unknown, not deleted.`,
      )
    }

    for (const key of removed) {
      await formsApi.clearConfigValue(formId, key)
    }

    /*
     * ⚠️ **The kept keys are sent BACK, because this endpoint is `replaceAll` and deletes what the body
     * omits.** Leaving them out of the payload would have the server delete exactly the keys this
     * function just decided not to delete — the guard above would read as protection and do nothing.
     * `FormConfigController.replaceAll`: *"upserts the entries given, deletes the rest"*.
     */
    const kept = Object.fromEntries(unknown.map((key) => [key, current[key]]))

    return formsApi.setConfigValues(formId, { ...kept, ...next })
  },
}

/**
 * Which forms one workspace shows, and everything that changes a form itself.
 *
 * ⚠️ **A form is installation-wide; which workspace *shows* it is a second fact.** That is why the list
 * a workspace draws comes from `/spaces/{id}/forms` and not from a filter over `/forms` — the second
 * would be this browser deciding a question the backend owns.
 */
export const formWriteApi = {
  create: (payload: {
    name: string
    description?: string
    icon?: string
    purposeId?: string
    categoryId?: string
    spaceId?: string
    audience?: FormAudience
  }) => http.post<FormDetail>("/forms", payload),

  /** ⚠️ Omit `audience` to leave it alone — only `form:write:system` may widen one past `MEMBERS`. */
  patch: (
    formId: string,
    payload: Partial<{
      name: string
      codename: string
      description: string
      icon: string
      purposeId: string
      categoryId: string
      audience: FormAudience
      status: string
    }>,
  ) => http.put<FormDetail>(`/forms/${formId}`, payload),

  delete: (formId: string) => http.delete<void>(`/forms/${formId}`),

  listByPurpose: (purposeId: string, page = 0, size = 25) =>
    http.get<Page<FormSummary>>(`/forms/purpose/${purposeId}`, { params: { page, size, sort: "name" } }),

  enableSharing: (formId: string) => http.post<{ shareToken: string }>(`/forms/${formId}/share`),

  disableSharing: (formId: string) => http.delete<void>(`/forms/${formId}/share`),
}

/**
 * Purposes and the categories under them.
 *
 * ⚠️ **A purpose carries behaviour; a category is only a heading.** `INVENTORY` is what makes a form a
 * component type — branch on the purpose's **code**, never on a form's identifier.
 */
export const formPurposesApi = {
  listPurposes: () => http.get<FormPurpose[]>("/purposes"),

  createPurpose: (payload: { code: string; label: string; description?: string; icon?: string; sortOrder?: number }) =>
    http.post<FormPurpose>("/purposes", payload),

  updatePurpose: (
    purposeId: string,
    payload: { label?: string; description?: string; icon?: string; sortOrder?: number },
  ) => http.put<FormPurpose>(`/purposes/${purposeId}`, payload),

  deletePurpose: (purposeId: string) => http.delete<void>(`/purposes/${purposeId}`),

  listCategories: (purposeId: string) => http.get<FormCategory[]>(`/purposes/${purposeId}/categories`),

  createCategory: (payload: {
    purposeId: string
    name: string
    description?: string
    icon?: string
    sortOrder?: number
  }) => http.post<FormCategory>("/categories", payload),

  updateCategory: (
    categoryId: string,
    payload: { name?: string; description?: string; icon?: string; sortOrder?: number },
  ) => http.put<FormCategory>(`/categories/${categoryId}`, payload),

  deleteCategory: (categoryId: string) => http.delete<void>(`/categories/${categoryId}`),
}

/**
 * The rows a form has collected.
 *
 * ⚠️ **`spaceId` travels as a parameter on the reads, not only in the header.** An entry belongs to the
 * workspace it was made in, and the same form collects rows in several — a list that took the workspace
 * from the header alone would be right until somebody opened two tabs.
 */
export const entriesApi = {
  /**
   * ⚠️ Three ways of narrowing, and they are deliberately separate parameters.
   *
   * `query` matches anything written on an entry — what somebody types without knowing which field holds
   * it. `jmq:filter` is an expression naming fields, operators and values; `jmq:order` is an expression
   * sort. The `jmq:` prefix keeps a plain column sort and an expression from ever being confused.
   */
  list: (
    formId: string,
    page = 0,
    size = 25,
    spaceId?: string,
    query?: string,
    filter?: string | null,
    order?: string | null,
  ) =>
    http.get<Page<FormEntry>>(`/forms/${formId}/entries`, {
      params: {
        page,
        size,
        spaceId,
        query,
        "jmq:filter": filter || undefined,
        "jmq:order": order || undefined,
      },
    }),

  listAll: (formId: string, spaceId?: string) =>
    http.get<FormEntry[]>(`/forms/${formId}/entries/all`, { params: { spaceId } }),

  count: (formId: string, spaceId?: string) =>
    http.get<{ count: number }>(`/forms/${formId}/entries/count`, { params: { spaceId } }),

  get: (formId: string, entryId: string) => http.get<FormEntry>(`/forms/${formId}/entries/${entryId}`),

  create: (formId: string, fieldValues: Record<string, string>, spaceId?: string) =>
    http.post<FormEntry>(`/forms/${formId}/entries`, { fieldValues }, { params: { spaceId } }),

  update: (formId: string, entryId: string, fieldValues: Record<string, string>) =>
    http.put<FormEntry>(`/forms/${formId}/entries/${entryId}`, { fieldValues }),

  delete: (formId: string, entryId: string) => http.delete<void>(`/forms/${formId}/entries/${entryId}`),
}

/**
 * What a public form does when the same person answers twice.
 *
 * ⚠️ **404 is the answer, not a failure.** A form nobody has constrained has no policy row, and the
 * hook reading this has to treat that as "unrestricted" rather than as an error — which is also why
 * going back to unrestricted is `delete`, not a save with every limit blanked.
 */
export const submissionPolicyApi = {
  get: (formId: string) => http.get<SubmissionPolicy>(`/forms/${formId}/submission-policy`),

  save: (
    formId: string,
    payload: {
      resubmissionAllowed: boolean
      maxPerIdentity: number | null
      cooldownMinutes: number | null
      identityStrategy: IdentityStrategy
      identityFieldName: string | null
    },
  ) => http.put<SubmissionPolicy>(`/forms/${formId}/submission-policy`, payload),

  delete: (formId: string) => http.delete<void>(`/forms/${formId}/submission-policy`),
}

/**
 * Every entry of a *purpose*, across every form that carries it.
 *
 * ⚠️ **A purpose, never a list of form ids.** "Everything this workspace stocks" spans as many forms as
 * there are component types, and asking form by form would page each one separately — so the answer
 * would have no total and no honest ordering.
 */
export const entryResultsApi = {
  byPurpose: (
    purposeCode: string,
    allSubmissions = false,
    page = 0,
    size = 25,
    spaceId?: string,
    query?: string,
  ) =>
    http.get<Page<FormEntry>>(`/forms/results/${purposeCode}`, {
      params: { allSubmissions, page, size, spaceId, query },
    }),

  /**
   * How many entries each of these forms holds.
   *
   * ⚠️ **One call rather than one per form.** The filter panel needs a count beside every type; asked
   * separately that is thirty requests to draw a sidebar.
   */
  batchCount: (formIds: string[], spaceId?: string) => {
    const parameters = new URLSearchParams(formIds.map((formId) => ["formIds", formId]))

    if (spaceId) {
      parameters.append("spaceId", spaceId)
    }

    return http.get<Array<{ formId: string; count: number }>>("/entries/batch-count", { params: parameters })
  },
}

/** One value of one field, and how many entries carry it. */
export interface FieldAggregateEntry {
  value: string
  count: number
}

export interface FieldAggregateResult {
  formId: string
  fieldName: string
  totalEntries: number
  buckets: FieldAggregateEntry[]
}

/**
 * How a form's answers are distributed across one field.
 *
 * ⚠️ **Computed by the server over every entry, not by the browser over a page.** A distribution built
 * from twenty-five loaded rows would be a chart of the page rather than of the form — and it is the one
 * kind of wrong that looks entirely plausible.
 */
export const aggregateApi = {
  byField: (formId: string, fieldName: string) =>
    http.get<FieldAggregateResult>(`/forms/${formId}/entries/aggregate`, { params: { fieldName } }),
}
