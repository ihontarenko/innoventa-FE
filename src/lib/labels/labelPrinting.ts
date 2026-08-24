import { escapeXml, labelSvg }                            from './labelSvg';
import {
    A4_HEIGHT_MM, A4_WIDTH_MM, pageRuleFor, sheetGridFor,
    type LabelPaperMode, type SheetSettings,
} from './labelPaper';
import type { LabelTemplateDetail, ResolvedLabelRecord } from '@/types';

/**
 * The three ways a label leaves the product — and the one document all of them are made of.
 *
 * <p><strong>Print, PNG and Files draw from one rendering path.</strong> Every function here composes
 * pages out of `labelSvg` and nothing else, because three renderers obliged to agree pixel-for-pixel
 * diverge at the first font. The differences between the three outputs are what happens to the pages
 * afterwards: a window that prints them, a canvas that rasterises one, an upload that files one.
 */

/**
 * As many labels as one press of print may produce.
 *
 * <p>The same number the resolve endpoint enforces, and it is enforced in both places on purpose: a
 * screen is not a security boundary, and a screen that let somebody ask for twelve thousand would
 * hang the browser before the server ever saw the request.
 */
export const LABEL_RUN_CEILING = 500;

/**
 * How many ids a screen asks its own list for when it is about to print.
 *
 * <p>⚠️ <strong>One past the ceiling, and that one matters.</strong> Asking for exactly the ceiling
 * makes the refusal unreachable — a filter matching nine hundred returns five hundred, the count
 * never exceeds the limit, and the run prints the first five hundred while saying nothing. The extra
 * row is what turns "there are more than you may print" into something the screen can notice.
 */
export const LABEL_RUN_PROBE = LABEL_RUN_CEILING + 1;

/**
 * How big the label is — all that counting pages and cells needs to know.
 *
 * <p>Narrower than a whole template on purpose: the print dialog knows the size before it has
 * fetched the design, and a wider type there would have to be faked with a cast.
 */
export interface LabelSize {
    widthMm:  number;
    heightMm: number;
}

export interface PrintRun {
    template: LabelSize;
    records:  ResolvedLabelRecord[];
    mode:     LabelPaperMode;
    sheet:    SheetSettings;
    /** How many of each record. Twenty identical bin labels are one action, not twenty. */
    copies:   number;
}

/** A run that actually draws something, as against one that is only being counted. */
export interface DrawablePrintRun extends PrintRun {
    template: LabelTemplateDetail;
}

/** The run expanded to one entry per label — copies flattened, order preserved. */
function labelsOf(run: PrintRun): ResolvedLabelRecord[] {
    const copies = Math.max(1, Math.floor(run.copies));
    return run.records.flatMap((record) => Array.from({ length: copies }, () => record));
}

/** How many labels this run will actually produce, for a screen that has to say so first. */
export function labelCountOf(run: PrintRun): number {
    return labelsOf(run).length;
}

/**
 * How many sheets of A4 this run will use, or how many roll pages.
 *
 * <p>⚠️ The offset is taken modulo a sheet, exactly as {@link sheetPages} takes it. Skipping cells is
 * about *this* sheet being half used; an offset larger than a sheet holds means the same thing about
 * the same one sheet, and counting it whole would promise blank pages that are never printed.
 */
export function pageCountOf(run: PrintRun): number {
    const total = labelCountOf(run);

    if (run.mode === 'ROLL') {
        return total;
    }

    const grid = sheetGridFor(run.template.widthMm, run.template.heightMm, run.sheet);
    return Math.max(1, Math.ceil((total + skippedCellsOn(run, grid.perSheet)) / grid.perSheet));
}

/** How many cells the first sheet gives up — never more than the sheet has. */
function skippedCellsOn(run: PrintRun, perSheet: number): number {
    return run.sheet.startOffset % perSheet;
}

// ── The document ──────────────────────────────────────────────────────────────

/**
 * The whole run as one printable HTML document.
 *
 * <p>Its own document rather than a print stylesheet over the application, because `@page size` is a
 * property of the document being printed: a rule that said `40mm 12mm` while the application's own
 * page was still A4 would be a rule the browser is entitled to ignore.
 */
export function printableDocument(run: DrawablePrintRun): string {
    const pages = run.mode === 'ROLL' ? rollPages(run) : sheetPages(run);

    return `<!doctype html><html><head><meta charset="utf-8">`
         + `<title>${escapeXml(run.template.name)}</title><style>`
         + pageRuleFor(run.mode, run.template.widthMm, run.template.heightMm)
         + `html, body { margin: 0; padding: 0; background: #ffffff; }`
         + `.page { break-after: page; page-break-after: always; position: relative; overflow: hidden; }`
         + `.page:last-child { break-after: auto; page-break-after: auto; }`
         + `.cell { position: absolute; }`
         + `svg { display: block; }`
         + `</style></head><body>${pages}</body></html>`;
}

/** One label, one page, N pages — what a thermal roll wants. */
function rollPages(run: DrawablePrintRun): string {
    return labelsOf(run).map((record) =>
        `<div class="page" style="width:${run.template.widthMm}mm;height:${run.template.heightMm}mm">`
        + labelSvg(run.template, record).svg
        + `</div>`).join('');
}

/**
 * A4, tiled — and the first {@code startOffset} cells left untouched.
 *
 * <p>The offset is counted against the *first* sheet only: skipping two cells means the first sheet
 * starts in the third cell and every sheet after it starts in the first, which is what a partly used
 * sheet followed by fresh ones actually looks like.
 */
function sheetPages(run: DrawablePrintRun): string {
    const grid   = sheetGridFor(run.template.widthMm, run.template.heightMm, run.sheet);
    const labels = labelsOf(run);
    const pages: string[] = [];

    let placed = skippedCellsOn(run, grid.perSheet);
    let cursor = 0;

    while (cursor < labels.length) {
        const cells: string[] = [];

        while (placed < grid.perSheet && cursor < labels.length) {
            const at = grid.cellAt(placed);
            cells.push(
                `<div class="cell" style="left:${at.x}mm;top:${at.y}mm;`
                + `width:${run.template.widthMm}mm;height:${run.template.heightMm}mm">`
                + labelSvg(run.template, labels[cursor]).svg
                + `</div>`);
            placed += 1;
            cursor += 1;
        }

        pages.push(
            `<div class="page" style="width:${A4_WIDTH_MM}mm;height:${A4_HEIGHT_MM}mm">`
            + cells.join('') + `</div>`);
        placed = 0;
    }

    return pages.join('');
}

// ── Print ─────────────────────────────────────────────────────────────────────

/**
 * Hand the run to the system print dialog.
 *
 * <p>A window of its own, opened and then closed by whoever printed it. A pop-up blocker refusing it
 * is reported rather than swallowed: a print that silently did nothing is the failure somebody
 * repeats four times before asking.
 */
export function printRun(run: DrawablePrintRun): void {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
        throw new Error(
            'The browser would not open a window to print into. Allow pop-ups for this site and '
            + 'press print again.');
    }

    printWindow.document.open();
    printWindow.document.write(printableDocument(run));
    printWindow.document.close();

    // ⚠️ `document.close()` on a written-into window usually fires `load` synchronously, so a listener
    // registered here would be registered after the event it is waiting for and the dialog would
    // never open. The state is checked instead, and the listener is only for the case where it has
    // not finished — which is what a listener is for.
    const openedWindow = printWindow;

    function openTheDialog() {
        openedWindow.focus();
        openedWindow.print();
    }

    if (printWindow.document.readyState === 'complete') {
        openTheDialog();
    } else {
        printWindow.addEventListener('load', openTheDialog, { once: true });
    }
}

// ── PNG ───────────────────────────────────────────────────────────────────────

/**
 * How many pixels one millimetre becomes in an exported PNG.
 *
 * <p>Stated rather than assumed, because a PNG has no physical size of its own — the phone app that
 * drives a Niimbot over Bluetooth is told "this is the label" and scales it to the roll. Eight pixels
 * per millimetre is 203 dpi, which is what almost every thermal head actually is.
 */
export const EXPORT_PIXELS_PER_MM = 8;

/**
 * One label as a PNG.
 *
 * <p>⚠️ <strong>This is not a nicety.</strong> It is what serves a Niimbot driven from its own phone
 * app over Bluetooth, where no system print dialog exists at all — one export closes a whole class of
 * printer. It is the same SVG through a canvas, which is why it costs almost nothing to have.
 */
export async function labelPng(
    template: LabelTemplateDetail,
    record:   ResolvedLabelRecord | null,
    pixelsPerMm = EXPORT_PIXELS_PER_MM,
): Promise<Blob> {
    const { svg } = labelSvg(template, record, {
        imageHrefs: await inlinedPictures(template, record),
    });

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(template.widthMm  * pixelsPerMm);
    canvas.height = Math.round(template.heightMm * pixelsPerMm);

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('This browser cannot rasterise a label.');
    }

    const picture = await loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('The label could not be exported.'))),
            'image/png');
    });
}

/**
 * Every picture on the label, fetched and turned into a `data:` URI.
 *
 * <p>⚠️ A canvas refuses to export an image that pulled in an external resource, so an SVG pointing
 * at `/_/file/…` would export blank — silently, and only in the PNG. Codes are already embedded by
 * the server; this closes the same hole for pictures.
 */
async function inlinedPictures(
    template: LabelTemplateDetail,
    record:   ResolvedLabelRecord | null,
): Promise<Record<string, string>> {
    const pictures = template.elements.filter((element) => element.type === 'IMAGE');
    if (pictures.length === 0) {
        return {};
    }

    const inlined: Record<string, string> = {};

    await Promise.all(pictures.map(async (element) => {
        const resolved = record?.elements[element.id] ?? element.content;
        const token    = resolved?.trim().split(':')[0];
        if (!token) {
            return;
        }
        try {
            const response = await fetch(`/_/file/${token}`);
            if (response.ok) {
                inlined[element.id] = await asDataUri(await response.blob());
            }
        } catch {
            // A picture that cannot be fetched is left out rather than failing the export: a label
            // missing its logo is still a label, and the alternative is no label at all.
        }
    }));

    return inlined;
}

function asDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const picture = new Image();
        picture.onload  = () => resolve(picture);
        picture.onerror = () => reject(new Error('The label could not be drawn for export.'));
        picture.src = source;
    });
}

/** A filename that says which record this label is about. */
export function labelFileName(template: LabelTemplateDetail, record: ResolvedLabelRecord | null): string {
    const subject = record?.id ?? 'blank';
    const safe    = `${template.name}-${subject}`.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
    return `${safe}.png`;
}

/**
 * Hand a blob to the browser as a download.
 *
 * <p>⚠️ The address is revoked on the next turn of the event loop rather than immediately after the
 * click. `click()` only *starts* the download; revoking in the same tick pulls the bytes out from
 * under a browser that has not read them yet, and the failure is a silently empty file on some
 * browsers and not others.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const address = URL.createObjectURL(blob);
    const anchor  = document.createElement('a');

    anchor.href     = address;
    anchor.download = fileName;
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(address), 0);
}
