import { themedFaviconPainter } from "@jmouse/ui"
import { drawMark } from "@/lib/mark"

/**
 * Innoventa's tab mark, redrawn in whichever of the themes is on.
 *
 * <p>⚠️ **Neither the drawing nor the painting is here.** The geometry moved to `lib/mark.ts`, which
 * imports nothing, because `vite.config.ts` draws the same mark into the stations' home-screen icons
 * and runs in Node — a shared glyph that imported the render layer could not be read there. Reading
 * the colours actually in force, encoding the markup and hanging it on the one `rel="icon"` link is
 * `@jmouse/ui`'s `themedFaviconPainter`, identical in every product.
 *
 * <p>`public/favicon.svg` hardcodes one blue and switches it on `prefers-color-scheme`, which is the
 * best a file requested before any script runs can do. It still paints the first frame, the bookmark
 * and the link preview; this takes over the moment a theme is known, so the tab carries the colour the
 * reader actually chose rather than the one the brand shipped.
 *
 * <p>⚠️ **The home-screen icons do NOT follow the theme, and the tab mark does.** They are files named
 * in a static manifest, read at launch before any of this runs. Same geometry, one palette apart.
 */

/** Hand this to `ThemeProvider`'s `onThemeApplied`. */
export const repaintMark = themedFaviconPainter(drawMark)
