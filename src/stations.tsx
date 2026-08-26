import { Cpu, type LucideIcon } from "lucide-react"
import type { PwaStation } from "@jmouse/pwa"
import { stationDefinitions } from "@/stationDefinitions"

/**
 * What each station is drawn with.
 *
 * ⚠️ **Keyed rather than declared beside the station, because `stationDefinitions` is read by the
 * build** — see the note there. Adding a station without a glyph here is caught by the compiler
 * (`Record<string, …>` would not have caught it; the lookup below throws instead), which is the point:
 * a station with no mark is a blank tile on a shelf whose whole job is to be recognisable.
 */
const GLYPHS: Record<string, LucideIcon> = {
  components: Cpu,
}

function glyphOf(key: string): LucideIcon {
  const glyph = GLYPHS[key]

  if (!glyph) {
    throw new Error(`Station '${key}' has no glyph. Every station needs one — a blank tile is not a tile.`)
  }

  return glyph
}

/** The stations, as the shelf and the install controls need them. */
export const stations: PwaStation[] = stationDefinitions.map((definition) => {
  const Glyph = glyphOf(definition.key)

  return { ...definition, icon: <Glyph /> }
})

/** The station one address belongs to, or null anywhere else in the interface. */
export function stationAt(pathname: string): PwaStation | null {
  return (
    stations.find(
      (station) => pathname === station.startPath || pathname.startsWith(`${station.startPath}/`),
    ) ?? null
  )
}
