import { http } from "./http"

/**
 * One link, seen from one of its two ends.
 *
 * ⚠️ **`outgoing` is the only thing that recovers direction.** The table stores each pair once and is
 * read symmetrically, so an answer naming only the far end reads identically from both sides — and the
 * guess that suggests itself, *what kind of thing is at the far end*, cannot tell the ends apart when
 * both are the same kind. Two resistors linked as a pair are exactly that case.
 */
export interface EntryLink {
  id: string
  linkedEntryId: string
  linkedFormId: string
  linkedFormName: string
  linkedEntryTitle: string
  /** What the two are to each other. ⚠️ Nullable — links written before labels existed carry none. */
  label: string | null
  outgoing: boolean
  createdAt: string
}

/**
 * ⚠️ **The label a CAD attachment carries, and the one thing this module must never treat as a
 * relation between two parts.** A part is attached to the symbol and footprint it is drawn as through
 * this same table; reading every link would offer a footprint as something to use instead of the part.
 * Nothing refuses it — a list of links looks like a list of links — so this filter is the whole defence,
 * exactly as `AlternatesBlockResolver` says on the backend.
 */
export const CAD_LINK_LABEL = "CAD"

/**
 * What two records can be to each other.
 *
 * ⚠️ **Suggestions, not a closed set.** The column is free text and older rows carry none at all, so an
 * enumeration here would be a validation the database never agreed to. These are what the picker offers;
 * anything typed is accepted.
 */
export const RELATION_LABELS = ["Alternate", "Complementary", "Pair", "Replaces", "Kit"] as const

export const entryLinksApi = {
  list: (entryId: string) => http.get<EntryLink[]>(`/entries/${entryId}/links`),

  create: (entryId: string, targetEntryId: string, label: string | null) =>
    http.post<EntryLink>(`/entries/${entryId}/links`, { targetEntryId, label: label || null }),

  /** ⚠️ Addressed by the LINK's id, which only a read hands out — never by the pair. */
  remove: (entryId: string, linkId: string) => http.delete<void>(`/entries/${entryId}/links/${linkId}`),
}
