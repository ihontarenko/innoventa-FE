import { useQuery } from "@tanstack/react-query"
import {
  parametricApi,
  type ParametricSearchResult,
  type ValueDimension,
  type ValueReading,
} from "@/api/parametric"

/**
 * ⚠️ **Long enough that a half-typed value is not read aloud.** The echo under the box exists to show
 * what the *finished* text means; asking after every keystroke makes it flicker through three wrong
 * answers on the way to the right one, which is worse than showing nothing.
 */
export const READING_DEBOUNCE_MILLISECONDS = 300

export function useValueDimensions() {
  return useQuery<ValueDimension[]>({
    queryKey: ["parametric", "dimensions"],
    queryFn: () => parametricApi.dimensions().then((response) => response.data),
    // A catalogue of physical dimensions is not going to change during a visit.
    staleTime: Infinity,
  })
}

/**
 * Every reading of the text as it stands.
 *
 * ⚠️ **An empty array means "unreadable", not "loading".** `3k3` and `33k` are one keystroke apart and
 * mean very different resistors; the screen has to be able to say *this is not a value* rather than
 * leaving somebody staring at a blank echo.
 */
export function useValueReadings(value: string, enabled: boolean) {
  return useQuery<ValueReading[]>({
    queryKey: ["parametric", "readings", value],
    queryFn: () => parametricApi.readings(value).then((response) => response.data),
    enabled: enabled && value.length > 0,
    staleTime: 5 * 60_000,
  })
}

export function useParametricSearch(magnitude: string, dimension: string, tolerancePercent: number, enabled: boolean) {
  return useQuery<ParametricSearchResult>({
    queryKey: ["parametric", "search", magnitude, dimension, tolerancePercent],
    queryFn: () => parametricApi.search(magnitude, dimension, tolerancePercent).then((response) => response.data),
    enabled: enabled && magnitude.length > 0,
  })
}
