import { http } from "./http"

/**
 * Which stations this account is offered, and where each one works.
 *
 * ⚠️ **Served rather than compiled in, and the reason is not tidiness.** Whether a station is offered
 * turns on the caller's permissions *and* on which modules each of their workspaces has enabled —
 * neither of which a browser holds. A shelf assembled here would offer tiles the backend then refuses,
 * which reads as a broken product rather than as a permission.
 *
 * ⚠️ **It says nothing about what a station looks like.** No name, no glyph, no address: those live in
 * `stationDefinitions.ts` because the build has to write a manifest for each one before any of this is
 * asked. The **backend owns whether, the interface owns what it is**, joined by `key`.
 */

/** The same three answers the workspace menu gives, for the same reasons. */
export type StationStanding = "PERMITTED" | "NO_PERMISSION" | "NOT_IN_PLAN"

export interface StationSpace {
  id: string
  slug: string
  name: string
  standing: StationStanding
}

export interface OfferedStation {
  key: string
  standing: StationStanding
  /**
   * The sentence to show whoever cannot open it, in the refusing axis's own words.
   *
   * ⚠️ Arrives as `undefined` rather than `null` where they can — this backend serializes non-null, so
   * a `=== null` test here is silently always false.
   */
  words?: string
  /** Where it works, best standing first. Never empty: a station available nowhere is absent. */
  availableIn: StationSpace[]
  /**
   * What this caller's craft would open first — true on at most one station, none where they hold no
   * craft.
   *
   * ⚠️ A hint, never a gate. Every station in this answer is already permitted; a craft has only
   * reordered them. Treating `false` as "not allowed" would invert the concept.
   */
  preferred: boolean
}

export interface OfferedStations {
  stations: OfferedStation[]
}

export const stationsApi = {
  /** @param spaceSlug narrows to one workspace; omitted, it answers across every reachable one */
  offered: (spaceSlug?: string) =>
    http.get<OfferedStations>("/stations", { params: { space: spaceSlug } }),
}
