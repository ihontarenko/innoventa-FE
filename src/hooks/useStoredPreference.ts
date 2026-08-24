import { useCallback, useState } from "react"

/**
 * A small choice about how to look at something, remembered between visits.
 *
 * ⚠️ **`localStorage`, not the server.** Rows-versus-tiles is a preference of the *machine somebody is
 * sitting at*, not of the account — the same person wants tiles on a wide monitor and rows on a laptop,
 * and a round trip to save it would make the toggle feel like a mutation.
 *
 * ⚠️ **Read lazily and defensively.** The key may hold whatever an older build wrote there, and a
 * private-mode browser refuses `localStorage` outright; either way the fallback is the default rather
 * than a blank screen.
 */
export function useStoredPreference<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (window.localStorage.getItem(key) as T | null) ?? fallback
    } catch {
      return fallback
    }
  })

  const store = useCallback(
    (next: T) => {
      setValue(next)

      try {
        window.localStorage.setItem(key, next)
      } catch {
        // A preference that could not be written is still a preference for this session.
      }
    },
    [key],
  )

  return [value, store]
}
