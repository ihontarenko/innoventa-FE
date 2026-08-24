import type { CSSProperties } from 'react';

/**
 * How much bigger one surface is than the application around it.
 *
 * <p>⚠️ **One vocabulary for three surfaces**, because they are one problem: an embedded form, the
 * markdown editor and a CodeMirror pane are all text somebody reads for a long time inside a frame
 * sized for glancing at. Left to themselves each would grow its own step size, its own clamp and its
 * own control — and the first thing that drifts is what "medium" means.
 *
 * <p>Where the number *comes from* is the only thing that differs, and it differs for a reason. An
 * embed is rendered inside somebody else's page, which this product does not control and whose reader
 * has no account here — so it is read from the URL, by whoever writes the embed code. An editor is
 * used by a signed-in person over and over, so it is a preference kept with their theme.
 */

/** The steps a surface may be scaled to — the same ladder the application's own font size uses. */
export const SURFACE_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const;

export type SurfaceScale = (typeof SURFACE_SCALES)[number];

export const DEFAULT_SURFACE_SCALE: SurfaceScale = 1;

/**
 * The nearest legal step to a number from outside.
 *
 * <p>⚠️ Clamped rather than trusted. `?scale=40` in an embed URL is a form forty times too big
 * wedged into somebody else's page, and `?scale=abc` is a `NaN` that renders nothing at all — both
 * arrive from a query string, which is to say from anybody.
 */
export function nearestSurfaceScale(value: unknown): SurfaceScale {
    const asked = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));

    if (!Number.isFinite(asked)) {
        return DEFAULT_SURFACE_SCALE;
    }

    return SURFACE_SCALES.reduce((closest, step) =>
        (Math.abs(step - asked) < Math.abs(closest - asked) ? step : closest));
}

/**
 * The scale an embed was asked for, read off its own address.
 *
 * <p>Both spellings are accepted: `?scale=1.25` is what somebody writes by hand, and `?scale=125`
 * is what they write when they are thinking in percent. Nothing distinguishes them but magnitude,
 * and guessing wrong in either direction is visible immediately.
 */
export function surfaceScaleInSearch(search: string): SurfaceScale {
    const asked = new URLSearchParams(search).get('scale');

    if (asked === null) {
        return DEFAULT_SURFACE_SCALE;
    }

    const parsed = Number.parseFloat(asked);

    return nearestSurfaceScale(Number.isFinite(parsed) && parsed > 10 ? parsed / 100 : parsed);
}

/**
 * The inline style that carries a scale to the `scaled-surface` utility in `index.css`.
 *
 * <p>A custom property rather than `zoom` directly, so the one place that decides *how* a surface is
 * scaled stays the stylesheet — and the day `zoom` is replaced by something better, it is replaced
 * once. ⚠️ It used to name `ui.module.css` here; that file is the OLD interface's and has never been
 * on this side, so the note pointed at a stylesheet nothing in this build loads.
 *
 * <p>⚠️ For <strong>embeds only</strong>. An embed is a whole page rendered in somebody else's
 * rectangle, so scaling all of it — text, controls, padding — is exactly right. An editor is not:
 * see {@link editorFontStyle}.
 */
export function surfaceScaleStyle(scale: SurfaceScale): CSSProperties {
    return { '--surface-scale': scale } as CSSProperties;
}

/** What an editor's text measures before anybody has an opinion — see `@jmouse/codemirror/editor`. */
const BASE_EDITOR_FONT_PX = 13.5;

/**
 * The same ladder, applied to an editor's <em>text</em> and to nothing else.
 *
 * <p>⚠️ **Deliberately not {@link surfaceScaleStyle}.** Zooming the surface scaled the toolbar, its
 * buttons and the dialogs they open along with the code — somebody who wanted larger text got a
 * larger application in one corner of the screen, and the control for the size ended up underneath
 * the wrapping toolbar it had just enlarged. This sets one custom property that only the CodeMirror
 * theme reads, so the size lands on the letters and the gutter and stops there.
 */
export function editorFontStyle(scale: SurfaceScale): CSSProperties {
    return { '--editor-font-size': `${BASE_EDITOR_FONT_PX * scale}px` } as CSSProperties;
}
