import { http } from "./http"
import type { Page } from "./forms"

/**
 * The register of what happened, across the features that keep one.
 *
 * ⚠️ **One route, not three answers merged here.** Stock, custody and projects each keep their own
 * register, and a browser merging them can show the first page and nothing after it: page three of a
 * merged list cannot be asked for without holding pages one and two. The backend merges, sorts and
 * pages; this reads it.
 */

/** Which register a row came out of. ⚠️ Two, not three — see {@link JournalRow}. */
export type JournalKind = "QUANTITY" | "CUSTODY"

/** Something a row points at — a position, an asset, a project, a person, a place. */
export interface JournalReference {
  type: string
  id: string
  label: string
}

/**
 * One thing that happened.
 *
 * ⚠️ **`delta` is absent on a custody row, never zero.** One thing handed over is not a movement of
 * nothing, and a column that totalled zeros would be a column that lies about a shelf.
 *
 * ⚠️ **A reservation is not here.** It is a standing promise with no history behind it — the audit log
 * is where reserving and releasing are recorded, and the Activity tab is what reads that.
 */
export interface JournalRow {
  id: string
  kind: JournalKind
  /** The reason or the custody act, in the register's own words — `ISSUE`, `RECEIPT`, `HANDED_OVER`. */
  event: string
  subject: JournalReference
  delta?: number
  counterparty?: JournalReference
  note?: string
  source?: string
  actorId?: string
  actorName?: string
  occurredAt: string
}

export interface JournalFilter {
  kind?: JournalKind
  event?: string
  entryId?: string
  assetId?: string
  projectId?: string
  locationId?: string
  holderId?: string
  /** A window back from now, in days. ⚠️ Absent means everything there is. */
  days?: number
}

export const journalApi = {
  read: (filter: JournalFilter = {}, page = 0, size = 50) =>
    http.get<Page<JournalRow>>("/journal", { params: { ...filter, page, size } }),
}
