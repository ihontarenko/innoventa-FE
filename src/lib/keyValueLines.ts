/**
 * A map of settings as `key=value` lines, and back.
 *
 * ⚠️ **This was written twice before it was written once, and the two had already drifted.**
 * `FormSettingsSheet` sorted on the way out and `AdvancedSection` did not — so the same configuration
 * rendered in two different orders depending on which editor somebody opened, and a diff between two
 * forms was mostly noise. Neither was wrong on its own; they simply had no reason to agree.
 *
 * ⚠️ **Split on the FIRST `=` only.** A value may contain one — `submit.success_redirect_url` with a
 * query string is the ordinary case — and splitting on every occurrence truncates it at the first
 * parameter, silently, leaving a URL that still looks like a URL.
 */
export function parseKeyValueLines(text: string): Record<string, string> {
  const config: Record<string, string> = {}

  for (const line of text.split("\n")) {
    const separator = line.indexOf("=")

    if (separator === -1) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (key) {
      config[key] = value
    }
  }

  return config
}

/** ⚠️ Sorted, so two configurations can be compared by eye and a difference is a difference. */
export function serializeKeyValueLines(config: Record<string, string>): string {
  return Object.entries(config)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
}
