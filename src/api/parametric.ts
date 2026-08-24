import { http } from "./http"

/** What the backend made of a written value. ⚠️ `recognized: false` is an answer, not a failure. */
export interface NormalizedValue {
  input: string
  recognized: boolean
  baseValue: number | null
  canonicalUnit: string | null
  /** The physical dimension, or `UNKNOWN` when the text named none. */
  kind: string
  normalizedDisplay: string | null
}

/** One physical dimension a search can be narrowed to. ⚠️ Never carries `UNKNOWN`. */
export interface ValueDimension {
  code: string
  baseUnit: string | null
  label: string
}

/**
 * One way of writing a value — a chip marking, a body code, a metric-prefix spelling.
 *
 * ⚠️ **Three states, and all three are shown.** `EXACT` reads back as the same value; `APPROXIMATE`
 * states what it reads back as *instead*; `NOT_EXPRESSIBLE` states why there is no such spelling. A
 * marking that is 1 % out is the thing a reader most needs told, and putting it behind a tooltip is how
 * somebody orders a reel of the wrong part.
 */
export interface ValueSpelling {
  family: string
  familyLabel: string
  text: string | null
  state: "EXACT" | "APPROXIMATE" | "NOT_EXPRESSIBLE"
  readsBackAs: number | null
  readsBackDisplay: string | null
  deviationPercent: number | null
  reason: string | null
  reasonLabel: string | null
}

/**
 * A **different** value on an E-series grid that happens to sit near this one — never a spelling.
 *
 * ⚠️ That distinction is the whole reason these live in their own section: `3.3 kΩ` and `3k3` are one
 * value written twice; `3.6 kΩ` is a different resistor, and a table holding both invites somebody to
 * copy the second believing it is the first.
 */
export interface StandardNeighbour {
  series: string
  member: boolean
  nearestValue: number | null
  nearestDisplay: string | null
  deviationPercent: number | null
  conventionalTolerancePercent: number
}

/**
 * One reading of written text.
 *
 * ⚠️ **There are usually several, and that is the point.** `332` is 332, 3.3 kΩ read as a resistor code,
 * and 3300 pF read as a capacitor code — one of those is what somebody meant, and a screen that picked
 * for them would be right most of the time and silently wrong the rest.
 */
export interface ValueReading {
  input: string
  route: string
  routeLabel: string
  value: NormalizedValue
  spellings: ValueSpelling[]
  standardNeighbours: StandardNeighbour[]
}

/** One stored value that fell inside the tolerance band. */
export interface ParametricMatch {
  entryId: string
  entryLabel: string
  formId: string
  formName: string
  fieldName: string
  fieldLabel: string
  textValue: string
  baseValue: number
  unit: string | null
  normalizedDisplay: string | null
  deviationPercent: number
}

export interface ESeriesSuggestion {
  value: number
  display: string | null
}

export interface ParametricSearchResult {
  query: NormalizedValue
  tolerancePercent: number
  bandLow: number | null
  bandHigh: number | null
  bandLowDisplay: string | null
  bandHighDisplay: string | null
  dimensionFilter: string | null
  unitFilter: string | null
  eSeriesE24: ESeriesSuggestion[]
  matchCount: number
  matches: ParametricMatch[]
}

export const parametricApi = {
  /** Every reading of written text — one for `3.3kOhm`, four for `332`, none for nonsense. */
  readings: (value: string) => http.get<ValueReading[]>("/parametric/readings", { params: { value } }),

  dimensions: () => http.get<ValueDimension[]>("/parametric/dimensions"),

  /**
   * ⚠️ **Magnitude and dimension travel separately and are never joined before parsing.** `10nF` glued
   * to `Ω` is `10nFΩ`, which parses cleanly and to the wrong answer by seventeen decades.
   */
  search: (magnitude: string, dimension: string, tolerancePercent: number, limit = 50) =>
    http.get<ParametricSearchResult>("/parametric/search", {
      params: { magnitude, dimension, tolerancePercent, limit },
    }),
}
