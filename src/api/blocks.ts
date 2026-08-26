import { createApiClient } from "./http"
import { LIBRARY_ROUTES } from "./libraryRoutes"
import type { MaterialCoverageStatus } from "./projects"

/**
 * ⚠️ **The LIBRARY's address, not Innoventa's `/api`** — `jmouse-liveblocks` serves these, and since
 * 2026-08-25 every library surface answers under `/jmouse/…`. It was `/api/blocks`, which is precisely
 * what a library must not take: the product's own URL space, where a route it wants one day collides
 * with this one and neither can start.
 *
 * ⚠️ **This address is a WIRE CONTRACT and is fixed in the library** — another product's document holds
 * a namespace and an origin and appends it. Moving it here alone would make Innoventa's blocks
 * unreachable from every consumer that was not moved in the same release.
 */
const http = createApiClient(LIBRARY_ROUTES.blocks)

/**
 * Live-data blocks — the directives a document embeds and this product answers.
 *
 * <h2>⚠️ Its own module, and it stays its own module now that there are pages again</h2>
 *
 * These types and calls sat beside the page store until that store was deleted, and they were moved out
 * because they were never about storage: a registry of directives that read **this** product's stock,
 * parts, BOMs and locations **at view time**, so a bring-up log written in March still shows correct
 * numbers in September. Moving them back would be a mistake, because the reason they left has outlived
 * the reason they were moved.
 *
 * <h2>⚠️ Whoever holds the markdown asks, and that is more than one product</h2>
 *
 * A page this product stores embeds directives; so does a page of the public manual, which Kiwi holds
 * and this product republishes. Both ask here. The address says `/jmouse/blocks` rather than
 * `/api/pages` for exactly that reason — a route named after one of the two stores would be wrong about
 * the other every time.
 */

/**
 * How a page is set — a typographic decision, not a content one.
 *
 * ⚠️ **Defined in `api/pages.ts`, and re-exported here.** It is a property of a page and it lived in
 * this module only while this product had no pages to put it on. Re-exported rather than moved outright
 * because every renderer already imports it from here, and two declarations of one type in two modules
 * is how the two stop agreeing.
 */
export type { PageRenderStyle } from "./pages"

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
  catalog: () => http.get<BlockCatalogEntry[]>("/catalog"),

  /** Resolve directives for a signed-in reader. Every resolver authorises against the data it reads. */
  resolve: (blocks: Array<{ name: string; argument: string }>) =>
    http.post<PageBlockResponse[]>("/resolve", blocks),
}
