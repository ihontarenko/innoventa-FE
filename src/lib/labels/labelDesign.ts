import {
    MINIMUM_CODE_SIDE_MM,
    type LabelElement, type LabelElementType, type LabelGeometry, type LabelTemplateDetail,
} from '@/types';

/**
 * How big a label is — all that placing something on one needs to know.
 *
 * <p>Written once here rather than as `{ widthMm: number; heightMm: number }` at half a dozen call
 * sites: it is a type wanting to be born, and it is the same pair the print run counts pages by.
 */
export interface LabelSize {
    widthMm:  number;
    heightMm: number;
}

/**
 * The rules the studio edits by: what a new element looks like, and where one is allowed to end up.
 *
 * <p>Separate from the canvas because these are decisions about a <em>design</em> rather than about
 * dragging — the same clamp has to hold whether an element was moved with a mouse, nudged with an
 * arrow key or resized from a number typed into the property panel, and three copies of it is three
 * chances for one of them to let a QR through at six millimetres.
 */

/** Free positioning is unusable at 12×40 without a grid: a millimetre is a few screen pixels. */
export const SNAP_MM = 0.5;

/**
 * Below this there is no label to design.
 *
 * <p>The server's own floor, spelled here so the create form refuses a size the save would refuse
 * anyway — and refuses it before somebody has typed a name.
 */
export const MINIMUM_LABEL_SIDE_MM = 5;

/** Round to the grid. Everything the studio writes goes through here. */
export function snap(millimetres: number): number {
    return Math.round(millimetres / SNAP_MM) * SNAP_MM;
}

/** Away from float dust, so a stored coordinate reads as a number a person typed. */
export function tidyMm(millimetres: number): number {
    return Math.round(millimetres * 100) / 100;
}

/**
 * The smallest this type may be — a code's floor is the readable minimum, everything else's is the
 * grid.
 *
 * <p>⚠️ The constraint is here rather than in a note, because a QR under about eight millimetres does
 * not scan on any phone and the failure is discovered in front of a shelf, on a sticker that is
 * already stuck down.
 */
export function minimumSideOf(type: LabelElementType): number {
    return type === 'QR' || type === 'BARCODE' ? MINIMUM_CODE_SIDE_MM : SNAP_MM;
}

/**
 * A rectangle snapped to the grid, no smaller than its type allows, and inside the label.
 *
 * <p>Nothing is placed outside the label because a label is printed at exactly its own size — an
 * element past the edge is not clipped, it is simply not there.
 */
export function clampToLabel(
    geometry: LabelGeometry,
    type:     LabelElementType,
    template: LabelSize,
): LabelGeometry {
    const floor = minimumSideOf(type);

    const width  = Math.min(Math.max(snap(geometry.width),  floor), template.widthMm);
    const height = Math.min(Math.max(snap(geometry.height), floor), template.heightMm);

    const x = Math.min(Math.max(snap(geometry.x), 0), template.widthMm  - width);
    const y = Math.min(Math.max(snap(geometry.y), 0), template.heightMm - height);

    return {
        x:        tidyMm(x),
        y:        tidyMm(y),
        width:    tidyMm(width),
        height:   tidyMm(height),
        rotation: geometry.rotation,
    };
}

/**
 * How near an edge has to be to another one before the studio shows a line through both.
 *
 * <p>Half a millimetre is one grid step, so a guide appears exactly when snapping would put the two
 * edges together — the line is telling the truth about what is about to happen rather than being a
 * separate opinion about it.
 */
const GUIDE_TOLERANCE_MM = SNAP_MM;

/** A line the studio draws while something is being dragged, in millimetres. */
export interface AlignmentGuide {
    orientation: 'VERTICAL' | 'HORIZONTAL';
    /** Where the line sits — an x for a vertical guide, a y for a horizontal one. */
    at:          number;
}

/**
 * Where this rectangle lines up with its neighbours, and with the label itself.
 *
 * <p>⚠️ Decision 6 names three things that make free positioning usable at 12×40, and this is the one
 * that is easy to leave out: snapping puts an element on a round number, but *round* is not *aligned*.
 * Two text boxes at 2.0 and 2.5 mm are both on the grid and visibly ragged, and at four screen pixels
 * per millimetre nobody sees the difference without a line drawn through it.
 *
 * <p>Edges only — left, centre and right; top, middle and bottom — because those are the alignments
 * somebody is actually reaching for, and a guide for every coordinate is a screen full of lines.
 */
export function guidesFor(
    moving:    LabelGeometry,
    others:    LabelElement[],
    template:  LabelSize,
): AlignmentGuide[] {
    const movingVertical   = [moving.x, moving.x + moving.width / 2,  moving.x + moving.width];
    const movingHorizontal = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];

    const candidateVertical = [
        0, template.widthMm / 2, template.widthMm,
        ...others.flatMap((element) => [
            element.geometry.x,
            element.geometry.x + element.geometry.width / 2,
            element.geometry.x + element.geometry.width,
        ]),
    ];
    const candidateHorizontal = [
        0, template.heightMm / 2, template.heightMm,
        ...others.flatMap((element) => [
            element.geometry.y,
            element.geometry.y + element.geometry.height / 2,
            element.geometry.y + element.geometry.height,
        ]),
    ];

    return [
        ...alignedWith(movingVertical,   candidateVertical,   'VERTICAL'),
        ...alignedWith(movingHorizontal, candidateHorizontal, 'HORIZONTAL'),
    ];
}

function alignedWith(
    movingEdges:    number[],
    candidateEdges: number[],
    orientation:    AlignmentGuide['orientation'],
): AlignmentGuide[] {
    const hits = new Set<number>();

    for (const candidate of candidateEdges) {
        if (movingEdges.some((edge) => Math.abs(edge - candidate) <= GUIDE_TOLERANCE_MM)) {
            hits.add(tidyMm(candidate));
        }
    }

    return [...hits].map((at) => ({ orientation, at }));
}

/** Whether this type will fit on this label at all — a 20×20 sticker has no room for a code. */
export function typeFitsOn(type: LabelElementType, template: LabelSize): boolean {
    const floor = minimumSideOf(type);
    return template.widthMm >= floor && template.heightMm >= floor;
}

/**
 * A new element of this type, placed somewhere sensible and carrying only its own properties.
 *
 * <p>The content is a working example rather than an empty string: an author who has just added a
 * text box wants to see something in it, and `{{ label }}` is what almost every label starts with.
 */
export function newElement(
    type:     LabelElementType,
    template: LabelTemplateDetail,
    existing: LabelElement[],
): LabelElement {
    const floor     = minimumSideOf(type);
    const preferred = preferredSizeOf(type, template);
    const geometry  = clampToLabel(
        { ...placeSomewhereFree(existing, template, preferred), rotation: 0 }, type, template);

    return {
        id:       uniqueElementId(type, existing),
        type,
        geometry: { ...geometry, width: Math.max(geometry.width, floor) },
        content:  startingContentOf(type),
        text:     type === 'TEXT'                    ? { ...STANDARD_TEXT }   : null,
        code:     minimumSideOf(type) > SNAP_MM      ? { ...STANDARD_CODE }   : null,
        image:    type === 'IMAGE'                   ? { ...STANDARD_IMAGE }  : null,
        stroke:   type === 'BOX' || type === 'LINE'  ? { ...STANDARD_STROKE } : null,
    };
}

/*
 * ⚠️ These four mirror the server's own `standard()` factories on `LabelTextStyle`,
 * `LabelCodeStyle`, `LabelImageStyle` and `LabelStrokeStyle`. They are spelled here because a new
 * element has to look right before it is ever sent anywhere — but they are the second copy, and if
 * one of them ever disagrees with the server the server wins, because it fills in whatever a request
 * leaves out.
 */
const STANDARD_TEXT: NonNullable<LabelElement['text']> =
    { fontSizeMm: 3, bold: false, align: 'LEFT', overflow: 'SHRINK' };
const STANDARD_CODE: NonNullable<LabelElement['code']> =
    { symbology: 'CODE_128', errorCorrection: 'MEDIUM', quietZone: 4 };
const STANDARD_IMAGE: NonNullable<LabelElement['image']> =
    { fit: 'CONTAIN' };
const STANDARD_STROKE: NonNullable<LabelElement['stroke']> =
    { thicknessMm: 0.3, filled: false };

function startingContentOf(type: LabelElementType): string {
    switch (type) {
        case 'TEXT':    return '{{ label }}';
        case 'QR':      return '{{ id }}';
        case 'BARCODE': return '{{ inventory_number }}';
        // A picture points at a file. Left empty on purpose — there is no file this could guess, and
        // an element pointing at nothing draws nothing rather than drawing something wrong.
        default:        return '';
    }
}

function preferredSizeOf(
    type: LabelElementType,
    template: LabelSize,
): { width: number; height: number } {
    switch (type) {
        case 'QR': {
            const side = Math.min(template.widthMm, template.heightMm) * 0.4;
            return { width: side, height: side };
        }
        case 'BARCODE': return { width: template.widthMm * 0.6, height: Math.min(10, template.heightMm * 0.3) };
        case 'IMAGE':   return { width: template.widthMm * 0.3, height: template.heightMm * 0.3 };
        case 'LINE':    return { width: template.widthMm * 0.6, height: SNAP_MM };
        case 'BOX':     return { width: template.widthMm * 0.4, height: template.heightMm * 0.3 };
        default:        return { width: template.widthMm * 0.5, height: Math.min(6, template.heightMm * 0.25) };
    }
}

/**
 * Somewhere the new element does not land exactly on top of the last one.
 *
 * <p>A cascade rather than a layout: two elements at the same coordinates look like one element, and
 * an author's first move is then to drag something they cannot see.
 */
function placeSomewhereFree(
    existing: LabelElement[],
    template: LabelSize,
    size:     { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
    const step   = SNAP_MM * 4;
    const offset = existing.length * step;

    return {
        x: Math.min(offset, Math.max(0, template.widthMm  - size.width)),
        y: Math.min(offset, Math.max(0, template.heightMm - size.height)),
        ...size,
    };
}

/**
 * An id nothing else on this template is using.
 *
 * <p>Ids are the key a resolved run comes back under, so a duplicate would print one element's
 * content in another's box — the server refuses that, and this is why it never has to.
 */
function uniqueElementId(type: LabelElementType, existing: LabelElement[]): string {
    const taken  = new Set(existing.map((element) => element.id));
    const prefix = type.toLowerCase();

    for (let sequence = 1; ; sequence += 1) {
        const candidate = `${prefix}-${sequence}`;
        if (!taken.has(candidate)) {
            return candidate;
        }
    }
}
