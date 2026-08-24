import { Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { WikiPanel } from "@/components/wiki/WikiPanel"
import { useSpace } from "@/hooks/useSpaceSettings"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Pages — **this workspace's wiki, kept in Kiwi** (INVT-0097, INVT-0120, INVT-0121; `KW-1` §1).
 *
 * <h2>⚠️ A host, and deliberately nothing else</h2>
 *
 * Everything this screen used to be — the tree, the states, the document — is {@link WikiPanel}, which
 * is the same shape Tessera's wiki tab uses. What is left here is the one thing that genuinely belongs
 * to *this* screen rather than to a wiki: **which branch of Kiwi it opens**, which is the active
 * workspace's (`INVT-0120`).
 *
 * <h2>⚠️ Innoventa stores none of this, and holds no opinion about who may read it</h2>
 *
 * The browser calls Kiwi directly, carrying the reader's own **Identity** token, and Kiwi decides. A
 * consumer that decided here would be a second authority, and two authorities cannot guarantee that a
 * refusal wins. So this file contains no permission check about pages at all — `page:read` gates the
 * menu entry, and that is a different question from what is *in* it.
 */
export function PagesPage() {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const space = useSpace(activeSpaceId ?? undefined)

  if (space.isLoading || !space.data) {
    return <Skeleton className="h-96 w-full" />
  }

  // ⚠️ About the WORKSPACE, not about the wiki: it decides which sentence an unconfigured wiki gets,
  // never who may read one. Kiwi answers the second question, and this product must not pre-empt it —
  // an owner with no Kiwi grant still sees an empty tree, and that is correct.
  const canConfigure =
    space.data.currentUserRole === "OWNER" || space.data.currentUserRole === "ADMIN"

  return (
    <>
      <PageHeader title="Pages" description="This workspace's wiki, kept in Kiwi" />

      {/* ⚠️ `?? null` is load-bearing, not defensive. The backend serialises with non_null, so an
          unset column arrives as **undefined and never null** — and `kiwiRootCategoryId === null`
          inside the panel is then silently false forever. Without this the first screen anybody opens
          on a fresh workspace reads "this wiki is not yours to read" instead of "no wiki is
          configured": the wrong sentence, blaming Kiwi for a setting nobody has made. */}
      <WikiPanel kiwiRootCategoryId={space.data.kiwiRootCategoryId ?? null} canConfigure={canConfigure} />
    </>
  )
}
