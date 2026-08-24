import type { QuerySubject } from "@jmouse/query"

/**
 * Innoventa's filterable listings, as the server names them.
 *
 * ⚠️ These strings are the `QuerySubject.name()` of a bean in the backend — `EntrySubject`,
 * `AssetSubject`. A name nobody registered is refused by the server naming what is registered, which is
 * the right failure: a builder that quietly drew nothing would read as *this form has no fields*.
 */
export const ENTRIES = "entries"
export const ASSETS = "assets"

/** One form's entries. ⚠️ The form is required — an entry listing IS one form. */
export const entriesOf = (formId: string): QuerySubject => ({
  name: ENTRIES,
  parameters: { formId },
})

/**
 * Things under custody. ⚠️ The form is optional: equipment spans several asset forms, and with none
 * chosen the vocabulary is the asset's own facts, which is the useful answer rather than a degraded one.
 */
export const assetsOf = (formId?: string): QuerySubject => ({
  name: ASSETS,
  parameters: { formId },
})
