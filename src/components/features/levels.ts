/**
 * Good, middling, bad — decided once for every indicator that has an opinion.
 *
 * ⚠️ **One scale, because six widgets used to each pick their own.** A score gauge that turned amber at
 * 40 % beside a percentage bar that turned amber at 45 % is two widgets disagreeing about the same
 * number on the same screen, and nobody can tell which one is right.
 *
 * ⚠️ **Theme tokens, never literals.** The old code hard-coded `#f59e0b` for "middling", so the one
 * colour that carries a *judgement* was the one colour that ignored all 29 palettes.
 */
export type Level = "good" | "middling" | "poor"

/** The thresholds, as fractions. ⚠️ Above 70 % is good, below 40 % is poor — everything else is between. */
export function levelOf(fraction: number): Level {
  if (fraction >= 0.7) {
    return "good"
  }

  return fraction >= 0.4 ? "middling" : "poor"
}

/** For `fill`, `stroke` and `background` — an actual colour value, not a class. */
export const LEVEL_COLOUR: Record<Level, string> = {
  good: "var(--chart-2)",
  middling: "var(--chart-4)",
  poor: "var(--destructive)",
}

/** For text. */
export const LEVEL_TEXT: Record<Level, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  middling: "text-amber-600 dark:text-amber-400",
  poor: "text-destructive",
}
