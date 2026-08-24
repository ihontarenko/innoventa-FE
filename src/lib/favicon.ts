import { themedFaviconPainter, type MarkColours } from "@jmouse/ui"

/**
 * Innoventa's tab mark, redrawn in whichever of the 29 themes is on.
 *
 * <p>⚠️ **Only the drawing is here.** Reading the colours actually in force, encoding the markup and
 * hanging it on the one `rel="icon"` link is `@jmouse/ui`'s `themedFaviconPainter` — identical in every
 * product.
 *
 * <p>`public/favicon.svg` hardcodes one blue and switches it on `prefers-color-scheme`, which is the
 * best a file requested before any script runs can do. It still paints the first frame, the bookmark
 * and the link preview; this takes over the moment a theme is known, so the tab carries the colour the
 * reader actually chose rather than the one the brand shipped.
 *
 * <h2>⚠️ The geometry is `public/favicon.svg`'s, and the two must not drift</h2>
 *
 * <p>The stacked chevrons on a stem — layers being counted, which is what the product does. The static
 * file draws them on a 32-unit plate with a 7-unit radius, and so does this. If the mark changes, both
 * change, and the static file is the one to change first because it is the one a reader sees before
 * this runs.
 *
 * <p>⚠️ **The three chevrons fade, and the fade is in the glyph rather than in the colour.** Each is
 * the same ink at a lower opacity, so it thins with whatever paper the theme puts behind it instead of
 * being a second colour that has to be chosen per theme.
 */

/** The plate's corner radius, on the file's 32-unit grid. */
const PLATE_RADIUS = 7

const STROKE = 2.6

function drawMark({ plate, ink }: MarkColours): string {
  const chevron = (y: number, tip: number, opacity: number): string =>
    `<polyline points="4,${y} 16,${tip} 28,${y}" fill="none" stroke="${ink}"` +
    ` stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"` +
    ` opacity="${opacity}"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">` +
    `<rect width="32" height="32" rx="${PLATE_RADIUS}" fill="${plate}"/>` +
    `<line x1="16" y1="5" x2="16" y2="16" stroke="${ink}" stroke-width="${STROKE}"` +
    ` stroke-linecap="round"/>` +
    chevron(12, 16, 1) +
    chevron(17, 21, 0.8) +
    chevron(22, 26, 0.5) +
    `</svg>`
  )
}

/** Hand this to `ThemeProvider`'s `onThemeApplied`. */
export const repaintMark = themedFaviconPainter(drawMark)
