import type { FormSummary } from "@/types"

/**
 * The form as the management screen needs it.
 *
 * ⚠️ **`Omit<…, "fieldCount">` so a `FormDetail` fits too.** The dialog is opened from a library row,
 * which holds a `FormSummary`; the page is reached by address and can only fetch a `FormDetail`, which
 * carries the fields and the configuration but not the summary's count. Everything below reads the same
 * five properties — id, name, icon, purpose, category, share token — so requiring the count would make
 * the page invent one.
 */
export type ManagedForm = Omit<FormSummary, "fieldCount">
