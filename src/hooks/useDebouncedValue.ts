import { useEffect, useState } from "react"

/**
 * A value that lags behind by a moment.
 *
 * ⚠️ **What it buys here is not performance, it is the audit trail.** A search box wired straight to a
 * request over `/admin/*` writes one server-side record per keystroke; the person who reads that trail
 * later has to work out which of forty entries was a decision and which was typing.
 */
export function useDebouncedValue<Value>(value: Value, delayMilliseconds = 250): Value {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMilliseconds)

    return () => window.clearTimeout(timer)
  }, [value, delayMilliseconds])

  return debounced
}
