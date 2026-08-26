/**
 * Innoventa's mark, as geometry — the stacked chevrons on a stem, layers being counted.
 *
 * <h2>⚠️ Why it is a file of its own with no imports at all</h2>
 *
 * <p>Two very different things draw it. The tab mark is painted in the browser, in whichever of the
 * themes is on; the home-screen icons are written to files by `vite.config.ts`, which runs in
 * **Node**. A single import of the render layer here would drag React into a build configuration, so
 * the colours are typed locally rather than borrowed — the shape is deliberately identical to
 * `@jmouse/ui`'s `MarkColours` and `@jmouse/pwa`'s `IconColours`, and structural typing does the rest.
 *
 * <p>⚠️ **The geometry is `public/favicon.svg`'s, and the three must not drift.** The static file
 * paints the first frame, the bookmark and the link preview; this paints the tab once a theme is known
 * and the home-screen icons at build time. If the mark changes, all three change, and the static file
 * is the one to change first because it is the one a reader sees before any of this runs.
 *
 * <p>⚠️ **The three chevrons fade, and the fade is in the glyph rather than in the colour.** Each is
 * the same ink at a lower opacity, so it thins with whatever paper the theme puts behind it instead of
 * being a second colour that has to be chosen per theme.
 */

/** The two colours a mark is drawn from — the plate it sits on, and the ink it is drawn in. */
export interface MarkPalette {
  readonly plate: string
  readonly ink: string
}

/** The plate's corner radius, on the file's 32-unit grid. */
const PLATE_RADIUS = 7

const STROKE = 2.6

export function drawMark({ plate, ink }: MarkPalette): string {
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

/**
 * The palette the **files** are drawn in, since a build has no computed styles to read.
 *
 * ⚠️ The SHIPPED brand blue — the light value in `public/favicon.svg`, not a token and not an invented
 * one. It was `#2563eb` for a day and disagreed with the file every reader actually sees first.
 *
 * The home-screen icon therefore does not follow the live theme
 * while the tab mark does. That asymmetry is real and deliberate: a manifest icon is a file named in a
 * static document, read at launch before anything of the application runs.
 */
export const DEFAULT_MARK_PALETTE: MarkPalette = { plate: "#1E78A4", ink: "#ffffff" }
