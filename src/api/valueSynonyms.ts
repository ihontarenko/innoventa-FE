import { http } from "./http"

/**
 * Two spellings that mean the same value.
 *
 * ⚠️ **The point is a *looked-up* value landing on an option that already exists.** A distributor sends
 * "Texas Instruments"; the dropdown offers "TI". Without a mapping the applied value is a new option
 * nobody chose, and the field quietly grows a second name for one manufacturer.
 */
export interface ValueSynonym {
  id: string
  /** ⚠️ `null` for a seeded mapping shared by every workspace — those are read-only here. */
  spaceId: string | null
  synonymGroup: string
  canonicalValue: string
  aliasValue: string
  global: boolean
}

/** The group manufacturer mappings live under. Named here so no caller writes the string out. */
export const SYNONYM_GROUP_MANUFACTURER = "MANUFACTURER"

export const valueSynonymsApi = {
  list: () => http.get<ValueSynonym[]>("/value-synonyms"),

  create: (payload: { synonymGroup: string; canonicalValue: string; aliasValue: string }) =>
    http.post<ValueSynonym>("/value-synonyms", payload),

  update: (
    synonymId: string,
    payload: { synonymGroup?: string; canonicalValue?: string; aliasValue?: string },
  ) => http.put<ValueSynonym>(`/value-synonyms/${synonymId}`, payload),

  delete: (synonymId: string) => http.delete<void>(`/value-synonyms/${synonymId}`),
}
