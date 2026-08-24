import type { SVGProps } from "react"

/**
 * The mark, drawn in `currentColor` — the same three-chevron stack as `public/favicon.svg`, so the tab
 * and the sidebar carry one shape.
 *
 * ⚠️ **No colour of its own.** The favicon paints its own plate because nothing in a browser tab
 * inherits; here the plate is the caller's `bg-primary` and the strokes are its foreground, which is
 * what keeps the mark legible in all 29 themes instead of in the two it was drawn against.
 */
export function InnoventaMark(properties: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...properties}>
      <line x1="16" y1="5" x2="16" y2="16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <polyline
        points="4,12 16,16 28,12"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="4,17 16,21 28,17"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <polyline
        points="4,22 16,26 28,22"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  )
}
