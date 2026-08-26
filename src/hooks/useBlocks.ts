import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { blocksApi, type BlockCatalogEntry, type PageBlockResponse } from "@/api/blocks"
import { resolveManualBlocks } from "@/api/manual"
import { publicPagesApi } from "@/api/public"
import type { BlockResolution } from "@/components/markdown/surface"

/**
 * Live-data blocks.
 *
 * ⚠️ **Separate from the page hooks, and it stays separate now that there are pages again.** These read
 * *this* product's stock, parts, BOMs and locations for whatever document happens to embed a directive —
 * and the documents come from more than one place: a page this product stores, a page of the manual that
 * Kiwi does. Tying the engine to either store would make the other one render notices.
 */

/** One `:::name argument` to resolve. */
export interface BlockDirective {
  readonly name: string
  readonly argument: string
}

/**
 * The directives this workspace may write.
 *
 * ⚠️ An **offer**, not a gate — a document written before a module was switched off still contains its
 * directives, and they must keep reading as a visible notice rather than as silence.
 */
export function useBlockCatalog() {
  return useQuery<BlockCatalogEntry[]>({
    queryKey: ["block-catalog"],
    queryFn: () => blocksApi.catalog().then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

function resolutionKey(resolution: BlockResolution): string[] {
  switch (resolution.mode) {
    case "authenticated":
      return ["auth"]
    case "publicShare":
      return ["share", resolution.shareToken]
    case "publicKiwi":
      return ["kiwi", resolution.address]
    case "none":
      return ["none"]
  }
}

function resolveDirectives(resolution: BlockResolution, directives: readonly BlockDirective[]) {
  // ⚠️ The API takes a mutable array and the caller's list is shared with React's render — copy it.
  const payload = [...directives]

  switch (resolution.mode) {
    case "authenticated":
      return blocksApi.resolve(payload)
    case "publicShare":
      return publicPagesApi.resolveBlocks(resolution.shareToken, payload)
    case "publicKiwi":
      return resolveManualBlocks(resolution.address, payload)
    case "none":
      throw new Error("block resolution requested for an inert surface")
  }
}

/**
 * Every `:::` directive in a document, resolved in **one** round trip.
 *
 * ⚠️ **Keyed by the resolution and the directive set, not by the markdown.** Editing prose around the
 * blocks must not refetch them — that is the difference between a live preview that types smoothly and
 * one that fires a request per keystroke — while adding or changing a block must.
 *
 * ⚠️ **Takes the directives, not the markdown.** Which names are worth resolving is decided by the
 * plugins installed on the surface, and this hook could not keep a copy of that list in step.
 */
export function usePageBlocks(directives: readonly BlockDirective[], resolution: BlockResolution) {
  const cacheKey = useMemo(
    () =>
      directives
        .map((directive) => `${directive.name}:${directive.argument.toLowerCase()}`)
        .sort()
        .join("|"),
    [directives],
  )

  return useQuery<PageBlockResponse[]>({
    queryKey: ["page-blocks", ...resolutionKey(resolution), cacheKey],
    queryFn: () => resolveDirectives(resolution, directives).then((response) => response.data),
    enabled: resolution.mode !== "none" && directives.length > 0,
    staleTime: 15_000,
  })
}
