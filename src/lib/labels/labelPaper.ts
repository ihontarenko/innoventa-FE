/**
 * The paper, which is chosen when printing and never stored on the design.
 *
 * <p>The template owns the **label's** size; this owns the **page**. The same 12×40 design goes to a
 * roll one label per page, or is tiled onto an A4 sheet — and neither of those is a property of the
 * design, which is why no column anywhere holds it.
 */

export type LabelPaperMode = 'ROLL' | 'SHEET';

/** A4 in millimetres. The only sheet this ships with; Letter is a line here when somebody asks. */
export const A4_WIDTH_MM  = 210;
export const A4_HEIGHT_MM = 297;

export interface SheetSettings {
    /** Blank border of the sheet itself, in millimetres. */
    marginMm: number;
    /** Space between labels, in millimetres. */
    gapMm:    number;
    /**
     * How many cells to skip before the first label.
     *
     * <p>⚠️ Not a nicety. A sheet of stickers is almost never whole, and without this every print
     * needs a fresh one — so people print onto crookedly reinserted sheets instead.
     */
    startOffset: number;
}

export const DEFAULT_SHEET: SheetSettings = { marginMm: 8, gapMm: 2, startOffset: 0 };

export interface SheetGrid {
    columns:      number;
    rows:         number;
    /** How many labels one sheet holds — the number a start offset is counted against. */
    perSheet:     number;
    /** Where each cell's top-left corner sits, in millimetres from the page corner. */
    cellAt:       (index: number) => { x: number; y: number };
}

/**
 * How many of this label fit on A4, and where each one sits.
 *
 * <p>Computed from the label's own size rather than from a table of stationery, because the label's
 * size is whatever somebody's roll happens to be — which is the entire reason this cluster ships an
 * editor instead of three fixed designs.
 */
export function sheetGridFor(
    labelWidthMm: number, labelHeightMm: number, settings: SheetSettings,
): SheetGrid {
    const usableWidth  = A4_WIDTH_MM  - settings.marginMm * 2;
    const usableHeight = A4_HEIGHT_MM - settings.marginMm * 2;

    const columns = Math.max(1, Math.floor(
        (usableWidth  + settings.gapMm) / (labelWidthMm  + settings.gapMm)));
    const rows    = Math.max(1, Math.floor(
        (usableHeight + settings.gapMm) / (labelHeightMm + settings.gapMm)));

    return {
        columns,
        rows,
        perSheet: columns * rows,
        cellAt: (index: number) => ({
            x: settings.marginMm + (index % columns) * (labelWidthMm  + settings.gapMm),
            y: settings.marginMm + Math.floor(index / columns) * (labelHeightMm + settings.gapMm),
        }),
    };
}

/**
 * The `@page` rule for this print, which is the whole defence of physical accuracy.
 *
 * <p>⚠️ An exact `size` and `margin: 0` are what stop the browser or the driver scaling the page.
 * Anything that lets them produces a label that is *nearly* right — which is worse than one that is
 * obviously wrong, because it gets stuck on before anybody measures it.
 */
export function pageRuleFor(
    mode: LabelPaperMode, labelWidthMm: number, labelHeightMm: number,
): string {
    return mode === 'ROLL'
        ? `@page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0; }`
        : `@page { size: A4; margin: 0; }`;
}
