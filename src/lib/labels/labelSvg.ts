import type {
    LabelElement, LabelTemplateDetail, ResolvedLabelRecord,
} from '@/types';

/**
 * One label, drawn as SVG in millimetres.
 *
 * <p><strong>This is the only place a label is drawn.</strong> The studio canvas, the print window
 * and the PNG export all call this function and render what it returns — because three renderers
 * obliged to agree pixel-for-pixel diverge at the first font, which is the trap the whole
 * browser-draws decision exists to avoid. The studio's drag handles sit *on top* of the result as a
 * separate overlay, which is honest: a handle is not part of the label.
 *
 * <p><strong>The viewBox is millimetres.</strong> One user unit is one millimetre, so every stored
 * coordinate goes straight in with no conversion anywhere. Pixels appear once, as a CSS width on the
 * element that contains this — the zoom — and never inside it.
 */

/**
 * What a label is set in. Deliberately a plain stack: a webfont that fails to load prints wrong.
 *
 * <p>⚠️ It contains a quoted family name, so it is <strong>escaped</strong> wherever it is written
 * into an attribute — see {@link FONT_STACK_ATTRIBUTE}. Written raw, its quotes closed the attribute
 * early and the whole document stopped being well-formed XML.
 */
const FONT_STACK = 'Helvetica, Arial, "Liberation Sans", sans-serif';

/**
 * The same stack, safe to write into an SVG attribute.
 *
 * <p>⚠️ <strong>This is what stopped every PNG export.</strong> The stack names `"Liberation Sans"`
 * in quotes, and interpolated raw it produced
 * <code>font-family="Helvetica, Arial, "Liberation Sans", sans-serif"</code> — the inner quote closes
 * the attribute and the document is no longer well-formed. The print window survived it because it
 * inserts the drawing as <em>HTML</em>, and an HTML parser recovers from a broken attribute; an SVG
 * loaded as an image is parsed as XML, where a well-formedness error is fatal and the whole label
 * fails to load. That is the entire distance between "printing works" and "the label could not be
 * drawn for export".
 */
const FONT_STACK_ATTRIBUTE = escapeXml(FONT_STACK);

/** Type below this cannot be read off a thermal print, so shrinking stops here and warns instead. */
const MINIMUM_FONT_SIZE_MM = 1.2;

/** Line spacing for wrapped text, as a multiple of the font size. */
const LINE_HEIGHT = 1.15;

export interface LabelRenderOptions {
    /**
     * Draw a faint outline around every element.
     *
     * <p>The studio only. Paper gets none of them — an outline that printed would be a design
     * decision nobody made.
     */
    outlines?: boolean;
    /**
     * Element id → picture to use instead of the resolved file link.
     *
     * <p>Needed only for the PNG export: a canvas refuses to export an image that pulled in an
     * external resource, so the export inlines every picture as a `data:` URI first. Screen and print
     * pass nothing and load the file normally.
     */
    imageHrefs?: Record<string, string>;
}

export interface RenderedLabel {
    /** The SVG document, ready to be inserted, printed or rasterised. */
    svg: string;
    /**
     * Elements whose real content does not fit the box drawn for them.
     *
     * <p>The studio's warning comes from here rather than from a second measurement, so what it warns
     * about is exactly what was drawn. Silent clipping is discovered on a glued box.
     */
    overflowing: string[];
}

/** One label of this template, filled in with one record — or with the palette's examples. */
export function labelSvg(
    template: LabelTemplateDetail,
    record:   ResolvedLabelRecord | null,
    options:  LabelRenderOptions = {},
): RenderedLabel {
    const overflowing: string[] = [];
    const body = [...template.elements]
        .map((element) => drawElement(element, record, options, overflowing))
        .join('\n');

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
        ` width="${template.widthMm}mm" height="${template.heightMm}mm"`,
        ` viewBox="0 0 ${template.widthMm} ${template.heightMm}">`,
        `<rect x="0" y="0" width="${template.widthMm}" height="${template.heightMm}" fill="#ffffff"/>`,
        body,
        `</svg>`,
    ].join('');

    return { svg, overflowing };
}

// ── One element ───────────────────────────────────────────────────────────────

function drawElement(
    element:     LabelElement,
    record:      ResolvedLabelRecord | null,
    options:     LabelRenderOptions,
    overflowing: string[],
): string {
    const { x, y, width, height, rotation } = element.geometry;
    const resolved = contentOf(element, record);

    const inner = (() => {
        switch (element.type) {
            case 'TEXT':    return drawText(element, resolved, overflowing);
            case 'QR':
            case 'BARCODE': return drawCode(element, record, options);
            case 'IMAGE':   return drawImage(element, resolved, options);
            case 'BOX':     return drawBox(element);
            case 'LINE':    return drawLine(element);
            default:        return '';
        }
    })();

    const outline = options.outlines
        ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none"`
          + ` stroke="#9aa0a6" stroke-width="0.1" stroke-dasharray="0.6 0.4"/>`
        : '';

    if (rotation === 0) {
        return inner + outline;
    }

    const centreX = x + width / 2;
    const centreY = y + height / 2;
    return `<g transform="rotate(${rotation} ${centreX} ${centreY})">${inner}${outline}</g>`;
}

/**
 * What this element says for this record.
 *
 * <p>With no record — a studio opened before anything is chosen — an element shows its own template
 * verbatim, which is the honest thing to show: it is what the author typed and is about the right
 * length to judge a box by.
 */
function contentOf(element: LabelElement, record: ResolvedLabelRecord | null): string {
    if (!record) {
        return element.content;
    }
    return record.elements[element.id] ?? '';
}

// ── Text ──────────────────────────────────────────────────────────────────────

function drawText(element: LabelElement, resolved: string, overflowing: string[]): string {
    const style = element.text;
    if (!style || !resolved) {
        return '';
    }

    const { x, y, width, height } = element.geometry;
    const lines = style.overflow === 'WRAP'
        ? wrapToWidth(resolved, width, style.fontSizeMm, style.bold)
        : [resolved];

    let fontSize = style.fontSizeMm;

    if (style.overflow === 'SHRINK') {
        const measured = measureTextWidthMm(resolved, fontSize, style.bold);
        if (measured > width) {
            fontSize = Math.max(MINIMUM_FONT_SIZE_MM, fontSize * (width / measured));
        }
    }

    const wroteTooMuch =
        lines.length * fontSize * LINE_HEIGHT > height + 0.01
        || lines.some((line) => measureTextWidthMm(line, fontSize, style.bold) > width + 0.01);

    if (wroteTooMuch) {
        overflowing.push(element.id);
    }

    const anchor    = style.align === 'CENTER' ? 'middle' : style.align === 'RIGHT' ? 'end' : 'start';
    const anchorX   = style.align === 'CENTER' ? x + width / 2 : style.align === 'RIGHT' ? x + width : x;
    // ⚠️ Escaped even though the server restricts an id to letters, digits, hyphens and underscores.
    // This string is inserted as HTML by the studio, so it is the second of two defences rather than
    // the only one — and it is the one that still holds for a row written before that rule existed.
    const clipId    = `clip-${escapeXml(element.id)}`;
    const clipped   = style.overflow === 'CLIP';

    // The first baseline sits one font-size down from the top of the box, which is close enough to a
    // cap height for a label and does not need the font's own metrics to compute.
    const drawn = lines.map((line, index) =>
        `<text x="${anchorX}" y="${y + fontSize * (1 + index * LINE_HEIGHT)}"`
        + ` font-family="${FONT_STACK_ATTRIBUTE}" font-size="${fontSize}"`
        + ` font-weight="${style.bold ? 700 : 400}" text-anchor="${anchor}" fill="#000000"`
        + `>${escapeXml(line)}</text>`).join('');

    if (!clipped) {
        return drawn;
    }

    return `<defs><clipPath id="${clipId}">`
         + `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`
         + `</clipPath></defs><g clip-path="url(#${clipId})">${drawn}</g>`;
}

/** Greedy word wrap. A word longer than the line gets its own line and overflows, which is reported. */
function wrapToWidth(text: string, widthMm: number, fontSizeMm: number, bold: boolean): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }

    const lines: string[] = [];
    let current = words[0];

    for (const word of words.slice(1)) {
        const candidate = `${current} ${word}`;
        if (measureTextWidthMm(candidate, fontSizeMm, bold) <= widthMm) {
            current = candidate;
        } else {
            lines.push(current);
            current = word;
        }
    }
    lines.push(current);

    return lines;
}

/**
 * How wide a string is, in millimetres, at this size.
 *
 * <p>Measured through a canvas because the browser is the thing that will draw it — an estimate from
 * average character widths is exactly the kind of nearly-right that produces a label somebody sticks
 * on before measuring. One reused context; the font size is set to a round number of pixels and the
 * result scaled, so the measurement does not depend on sub-pixel font hinting.
 */
const MEASUREMENT_FONT_SIZE_PX = 100;
let measurementContext: CanvasRenderingContext2D | null = null;

function measureTextWidthMm(text: string, fontSizeMm: number, bold: boolean): number {
    if (!text) {
        return 0;
    }
    if (!measurementContext) {
        measurementContext = document.createElement('canvas').getContext('2d');
    }
    if (!measurementContext) {
        // No canvas at all — refuse to guess, and let nothing report as overflowing rather than
        // reporting everything.
        return 0;
    }

    measurementContext.font =
        `${bold ? 700 : 400} ${MEASUREMENT_FONT_SIZE_PX}px ${FONT_STACK}`;

    return (measurementContext.measureText(text).width / MEASUREMENT_FONT_SIZE_PX) * fontSizeMm;
}

// ── Codes, pictures and shapes ────────────────────────────────────────────────

/**
 * A code is drawn by the server and embedded here as a `data:` URI.
 *
 * <p>With no record there is nothing to encode, so the studio shows an empty frame — which is the
 * truthful thing to show, because a placeholder QR would tell an author nothing about whether the
 * real payload fits.
 */
function drawCode(
    element: LabelElement, record: ResolvedLabelRecord | null, options: LabelRenderOptions,
): string {
    const drawn = record?.codes[element.id];
    const { x, y, width, height } = element.geometry;

    if (!drawn) {
        // ⚠️ The empty frame is the studio's, not paper's. On a label it would print a grey
        // rectangle where a code should be — a mark nobody chose, on a sticker somebody glues down.
        // A code with nothing to encode prints as nothing at all.
        return options.outlines
            ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none"`
              + ` stroke="#c8ccd0" stroke-width="0.2"/>`
            : '';
    }

    // ⚠️ A QR must stay square or it stops scanning, so it is fitted into the box and centred rather
    // than stretched to it. A linear barcode is the opposite: its bar *widths* carry the data and its
    // height is free, so it fills the box and `preserveAspectRatio="none"` is correct there.
    const side    = Math.min(width, height);
    const offsetX = x + (width - side) / 2;
    const offsetY = y + (height - side) / 2;
    const fitted  = element.type === 'QR'
        ? `x="${offsetX}" y="${offsetY}" width="${side}" height="${side}"`
        : `x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"`;

    return `<image ${fitted} href="${escapeXml(drawn)}"/>`;
}

function drawImage(element: LabelElement, resolved: string, options: LabelRenderOptions): string {
    const href = options.imageHrefs?.[element.id] ?? fileHrefOf(resolved);
    if (!href) {
        return '';
    }

    const { x, y, width, height } = element.geometry;
    const preserve = element.image?.fit === 'FILL'
        ? 'none'
        : element.image?.fit === 'COVER'
            ? 'xMidYMid slice'
            : 'xMidYMid meet';

    return `<image x="${x}" y="${y}" width="${width}" height="${height}"`
         + ` preserveAspectRatio="${preserve}" href="${escapeXml(href)}"/>`;
}

/**
 * The file a picture element points at.
 *
 * <p>Its content resolves to either a bare view token or the `"{token}:{filename}"` a file field
 * stores, so both are accepted — a logo chosen in the studio and a photo taken from a record's own
 * field reach here by different routes and must draw the same.
 */
function fileHrefOf(resolved: string): string | null {
    const trimmed = resolved.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    const token = trimmed.split(':')[0];
    return token ? `/_/file/${token}` : null;
}

function drawBox(element: LabelElement): string {
    const { x, y, width, height } = element.geometry;
    const stroke = element.stroke;
    if (!stroke) {
        return '';
    }

    return `<rect x="${x}" y="${y}" width="${width}" height="${height}"`
         + ` fill="${stroke.filled ? '#000000' : 'none'}"`
         + ` stroke="#000000" stroke-width="${stroke.thicknessMm}"/>`;
}

/** A rule down the middle of its own rectangle, along whichever side is longer. */
function drawLine(element: LabelElement): string {
    const { x, y, width, height } = element.geometry;
    const stroke = element.stroke;
    if (!stroke) {
        return '';
    }

    const horizontal = width >= height;
    const from = horizontal ? [x, y + height / 2] : [x + width / 2, y];
    const to   = horizontal ? [x + width, y + height / 2] : [x + width / 2, y + height];

    return `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"`
         + ` stroke="#000000" stroke-width="${stroke.thicknessMm}" stroke-linecap="butt"/>`;
}

// ── Plumbing ──────────────────────────────────────────────────────────────────

/**
 * Markup-safe text, for anything that reaches the drawing.
 *
 * <p>Exported because the printable document is built from these same strings and was escaping them
 * with a second, weaker copy of this — two spellings of "safe" is one of them being wrong.
 */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
