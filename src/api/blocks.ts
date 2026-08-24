import { http } from "./http"
import type { MaterialCoverageStatus } from "./projects"

/**
 * Live-data blocks — the directives a document embeds and this product answers (INVT-0099).
 *
 * <h2>⚠️ Not `api/pages.ts` any more, because Innoventa has no pages</h2>
 *
 * These types and calls used to sit beside a page store that has been deleted: the pages live in Kiwi,
 * which owns them and decides who reads them. What survived is the half that was never about storage —
 * a registry of directives that read **this** product's stock, parts, BOMs and locations **at view
 * time**, so a bring-up log written in March still shows correct numbers in September.
 *
 * <h2>⚠️ Whoever holds the markdown asks, and that is somebody else now</h2>
 *
 * A screen renders a Kiwi document and asks here for the numbers in it. The address moved with the
 * ownership — `/api/blocks` rather than `/api/pages` — because a route named after a store this
 * product no longer has is a lie that survives every refactor.
 */

/**
 * How a page is set — a typographic decision, not a content one.
 *
 * ⚠️ **It changes the reading, never the markdown.** The same source renders as a datasheet, an essay
 * or a dense reference; a style that rewrote content would make the source and the page two different
 * documents.
 */
export type PageRenderStyle = "REGULAR" | "TECHNICAL" | "EDITORIAL" | "COMPACT" | "ACADEMIC"

/**
 * One live-data directive this workspace may write, as the editor's block palette needs it.
 *
 * ⚠️ **`publicSafe` is about the *reader*, not the author.** A directive that is not public-safe still
 * goes into the document; it comes back `RESTRICTED` when a stranger reads the page, which is why the
 * palette can offer it without the page becoming un-shareable.
 */
export interface BlockCatalogEntry {
  name: string
  /** The module it came in under, for grouping — or for explaining why it is on offer. */
  module: string
  label: string
  argumentHint: string
  example: string
  publicSafe: boolean
}

export type PageBlockStatus = "RESOLVED" | "NOT_FOUND" | "AMBIGUOUS" | "RESTRICTED"

/**
 * One resolved live-data directive.
 *
 * ⚠️ **Exactly one payload is non-null, and which one is the directive's answer, not its name.** A
 * renderer dispatches on the payload rather than on `name` — that is what lets the server answer
 * `:::part` with an identity card on a public view and with a linked card in-app, from one shape.
 */
export interface PageBlockResponse {
  name: string
  argument: string
  status: PageBlockStatus
  part: null | {
    /** ⚠️ Null on a public view — the identity card renders without an internal link. */
    entryId: string | null
    formId: string | null
    partNumber: string | null
    manufacturer: string | null
    componentClass: string | null
    packageName: string | null
    lifecycle: string | null
    datasheetUrl: string | null
  }
  stock: null | {
    entryId: string
    formId: string
    label: string
    formName: string
    /** ⚠️ `null` means the type does not count, which is different from counting zero. */
    quantity: number | null
  }
  bom: null | {
    projectId: string
    name: string
    status: string
    totalMaterialCount: number
    coveredMaterialCount: number
    shortageMaterialCount: number
    unsourcedMaterialCount: number
    buildableQuantity: number
    limitingMaterialLabel: string | null
    lines: Array<{
      referenceDesignator: string | null
      componentDescription: string
      quantityRequired: number
      stockQuantityCached: number | null
      coverageStatus: MaterialCoverageStatus
    }>
  }
  eseries: null | {
    input: string
    normalizedDisplay: string
    kind: string
    bandLow: string
    bandHigh: string
    values: string[]
  }
  alternates: null | {
    entryId: string | null
    partNumber: string | null
    alternates: Array<{
      entryId: string | null
      partNumber: string | null
      formName: string | null
      kind: string | null
    }>
  }
  location: null | {
    entryId: string
    formId: string
    label: string
    path: string | null
  }
  datasheet: null | {
    partNumber: string | null
    url: string
    page: number | null
  }
}


export const blocksApi = {
  /**
   * The directives this workspace may write.
   *
   * ⚠️ An **offer**, not a gate — resolution deliberately does not consult it, so a document written
   * before a module was switched off still reads as a visible notice rather than as silence.
   */
  catalog: () => http.get<BlockCatalogEntry[]>("/blocks/catalog"),

  /** Resolve directives for a signed-in reader. Every resolver authorises against the data it reads. */
  resolve: (blocks: Array<{ name: string; argument: string }>) =>
    http.post<PageBlockResponse[]>("/blocks/resolve", blocks),
}
