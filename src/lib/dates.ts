/**
 * Dates, in the reader's own locale.
 *
 * ⚠️ **Never `toLocaleString()` with no options.** The browser's default for a bare call is
 * `18/08/2026` in one locale and `8/18/2026` in another, and a trial that ends "on 08/09" is a support
 * conversation about which month that was. Naming the month is what makes a date unambiguous to
 * everybody who reads it.
 */
export function readableDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** The same, with the time — for a trail where two entries a minute apart have to be told apart. */
export function readableMoment(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * "in 3d", "3d ago" — the same distance, said in whichever direction it actually runs.
 *
 * ⚠️ **`relativeTime` speaks only about the past, and answers "just now" for everything ahead of it.**
 * Its arithmetic is `now - then`, so a due date next February comes out negative, falls through every
 * band and lands on the first one. That is silent and it is exactly wrong where it matters most: a
 * thing due back on Friday and a thing due back in a year both read *just now*.
 *
 * ⚠️ **Past the week, this hands over to a date.** `relativeTime`'s own header says why — a relative
 * stamp is right for an activity feed and wrong where somebody has to put something in a calendar.
 */
export function relativeMoment(isoString: string): string {
  const minutes = Math.round((new Date(isoString).getTime() - Date.now()) / 60_000)

  if (minutes < 0) {
    return relativeTime(isoString)
  }

  if (minutes < 1) {
    return "any moment"
  }

  if (minutes < 60) {
    return `in ${minutes}m`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `in ${hours}h`
  }

  const days = Math.floor(hours / 24)

  return days < 7 ? `in ${days}d` : readableDate(isoString)
}

/**
 * "3d ago" — for a list where *how long since* is the question, not *when exactly*.
 *
 * ⚠️ Beside {@link readableDate} and deliberately not the same thing. A relative stamp is right for an
 * activity feed and wrong on a trial's expiry, where somebody needs a date to put in a calendar.
 */
export function relativeTime(isoString: string): string {
  const elapsedMinutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)

  if (elapsedMinutes < 1) {
    return "just now"
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`
  }

  const elapsedDays = Math.floor(elapsedHours / 24)

  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`
  }

  return new Date(isoString).toLocaleDateString()
}
