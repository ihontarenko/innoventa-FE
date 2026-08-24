import { useEffect, useState } from "react"

/**
 * Whether a media query matches, kept in step as the window changes.
 *
 * ⚠️ **Subscribed, not read once.** Reading `matchMedia(...).matches` during render answers for the
 * size the window happened to be at that moment — so a layout that swaps a pane for a sheet leaves both
 * open when somebody resizes, which is exactly the bug this hook exists to prevent.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const onChange = () => setMatches(mediaQueryList.matches)

    setMatches(mediaQueryList.matches)
    mediaQueryList.addEventListener("change", onChange)

    return () => mediaQueryList.removeEventListener("change", onChange)
  }, [query])

  return matches
}

/**
 * The one breakpoint the builder switches on — Tailwind's `lg`.
 *
 * ⚠️ Written once, here, because the layout's `lg:` classes and this value are one decision. Two
 * spellings of it is how a sheet and a pane end up open together.
 */
export function useIsWideLayout(): boolean {
  return useMediaQuery("(min-width: 64rem)")
}
