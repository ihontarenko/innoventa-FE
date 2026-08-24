import { cn } from "@jmouse/ui"
import type { PageRenderStyle } from "@/api/blocks"

/**
 * A page's rendered **voice**.
 *
 * ⚠️ **Typography only — the markdown is untouched.** The same source reads as a datasheet, an essay or
 * a dense reference; a style that changed content would make the source and the page two different
 * documents, and nobody could say which one was the record.
 *
 * ⚠️ **Every style is a full definition, not a diff from `REGULAR`.** A style expressed as "regular but
 * tighter" is a style that silently changes whenever regular does — which is how a technical page came
 * to inherit an essay's measure.
 */
const VOICES: Record<PageRenderStyle, string> = {
  /** Ordinary reading: comfortable measure, generous spacing. */
  REGULAR: "prose-base max-w-[68ch] leading-relaxed",

  /**
   * A datasheet. Wide, because a technical page is mostly tables and code and a narrow measure breaks
   * both; tight, because it is scanned rather than read.
   */
  TECHNICAL: "prose-sm max-w-none leading-normal [&_table]:text-xs [&_pre]:text-xs",

  /** An article. Narrow measure, larger type, room around the headings. */
  EDITORIAL: "prose-lg max-w-[62ch] leading-loose",

  /** A reference somebody greps with their eyes: as much on screen as will fit. */
  COMPACT: "prose-sm max-w-none leading-snug [&_p]:my-1.5 [&_h2]:mt-4 [&_h3]:mt-3 [&_ul]:my-1.5",

  /** A paper. Serif body, wide margins, numbered feel. */
  ACADEMIC: "prose-base max-w-[64ch] leading-loose font-serif [&_code]:font-mono",
}

/**
 * The wrapper class for a render style.
 *
 * ⚠️ **`dense` is a *surface* decision, not a style one.** The same page is read full-width on its own
 * page and inside a 22rem panel; shrinking it there is about the room available, so it composes with
 * every voice rather than being a sixth one.
 */
export function proseWrapperClass(
  renderStyle: PageRenderStyle,
  dense: boolean,
  className?: string,
): string {
  return cn(
    "prose prose-neutral dark:prose-invert",
    VOICES[renderStyle],
    dense && "prose-sm max-w-none [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm",
    className,
  )
}
