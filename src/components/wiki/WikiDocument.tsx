import { useEffect, useState } from "react"
import { History, Trash2 } from "lucide-react"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { MarkdownField } from "@/components/markdown/MarkdownField"
import {
  flattenKiwiTree,
  resolveKiwiAssets,
  unresolveKiwiAssets,
  type KiwiCategoryNode,
  type KiwiMember,
  type KiwiPageDetail,
} from "@/api/kiwi"

/**
 * One page, read and written in place — **the page is Kiwi's** (INVT-0121's anatomy, INVT-0121's source).
 *
 * ⚠️ **The renderer is `InnoventaMarkdown`, through `MarkdownField`** — the same stack that draws every
* document here. A second Markdown engine in the same application is how two documents in one product
 * stop looking alike.
 *
 * ⚠️ **The "no version history" warning is gone, because it stopped being true.** Kiwi writes a revision
 * on every save from the very first one (KW-1 §6), so a save no longer destroys what was there. The note
 * that replaced it says where the history is, which is the thing somebody actually needs to know: not
 * here.
 *
 * ⚠️ **Every write control is offered and none is guarded on a guess.** Innoventa holds no opinion about
 * who may edit a page — Kiwi decides, per section, through its own grants — so the interface offers the
 * control and repeats Kiwi's answer. Hiding a button on a local guess would reproduce Kiwi's rules here,
 * badly, and the first time the two disagreed the wrong one would be the invisible one.
 */
export function WikiDocument({
  page,
  isLoading,
  root,
  isSaving,
  onSave,
  onFile,
  onDelete,
}: {
  page: KiwiPageDetail | undefined
  isLoading: boolean
  /** The project's branch of Kiwi's tree — the only sections a page of this project may be filed into. */
  root: KiwiCategoryNode
  isSaving: boolean
  onSave: (title: string, markdown: string) => void
  onFile: (categoryId: string) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState("")

  // A save elsewhere — another tab, Kiwi's own screen, a tool call — has to win over a title nobody is
  // typing into, and switching pages has to reset it. Keyed on the id as well as the title so both are
  // one rule.
  useEffect(() => {
    setTitle(page?.title ?? "")
  }, [page?.id, page?.title])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!page) {
    return null
  }

  function commitTitle() {
    if (title.trim() && title.trim() !== page?.title) {
      onSave(title.trim(), page?.contentMarkdown ?? "")
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur()
            }
            if (event.key === "Escape") {
              setTitle(page.title)
            }
          }}
          className="h-auto border-transparent bg-transparent px-2 py-1 font-display text-xl font-semibold tracking-[-0.02em] shadow-none hover:border-input focus-visible:border-input"
        />

        <div className="flex flex-wrap items-center gap-2 px-2 text-xs text-muted-foreground">
          {/* ⚠️ A byline built from Kiwi's own naming, never a face. Kiwi has its own members table with
              its own avatars and so does Innoventa (KW-1 §9); drawing Kiwi's would put two faces on one
              person across two screens of the same product. */}
          {page.author && <span>Written by {kiwiMemberName(page.author)}</span>}
          {page.updatedBy && page.updatedBy.id !== page.author?.id && (
            <span>· Last edited by {kiwiMemberName(page.updatedBy)}</span>
          )}

          {/* Filed where — a select rather than a drag, because the tree is on the other side of the
              screen and a drag between two scroll containers is the interaction people miss.
              ⚠️ Only sections inside this project's branch: filing a page out of the branch would
              remove it from this wiki without deleting it, which reads as data loss. */}
          <select
            className="ml-auto rounded-md border bg-transparent px-2 py-1 text-xs"
            value={page.categoryId}
            onChange={(event) => onFile(event.target.value)}
          >
            {flattenKiwiTree([root])
              .filter(({ node }) => node.readable)
              .map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {" ".repeat(depth * 3)}
                  {node.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <History className="mt-0.5 size-3.5 shrink-0 opacity-70" />
        <span>
          This page lives in Kiwi, which keeps a revision of every save — {page.revisionCount}{" "}
          {page.revisionCount === 1 ? "so far" : "so far"}. Its history, its comments and who may read it
          are all over there; this tab is a window onto it.
        </span>
      </p>

      {/* ⚠️ No block provider, unlike Tessera's copy of this screen. Tessera resolves a page's live
          directives through a project-scoped route because its own route gated on the page being in
          its database — a check it lost when the pages moved. Innoventa never had that gate: its
          resolvers authorise the reader against the data they read, so `APP_SURFACE` and the ordinary
          /api/blocks/resolve are all this needs, with Innoventa's own token (INVT-0121). */}
        <MarkdownField
          // ⚠️ Rewritten, not passed through: Kiwi stores its images as root-relative paths, which
          // resolve against TESSERA here and draw as broken pictures (INVT-0121).
          value={resolveKiwiAssets(page.contentMarkdown, page.assetBase)}
          canEdit={!isSaving}
          placeholder="Write the page…"
          emptyText="This page has nothing on it yet."
          // ⚠️ Unresolved on the way out, or the save writes TESSERA's view of Kiwi's address into
          // Kiwi's own database — for every reader, including Kiwi's own screens. The pair must stay
          // symmetric; see resolveKiwiAssets.
          onCommit={(markdown) => onSave(title.trim() || page.title, unresolveKiwiAssets(markdown, page.assetBase))}
        />

      <div className="flex justify-end border-t pt-3">
        <Button variant="ghost" size="sm" className="text-destructive-ink" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete page
        </Button>
      </div>
    </div>
  )
}

/**
 * ⚠️ **Not `memberName` from `lib/memberDisplay`** — that one takes a Innoventa member. A Kiwi payload
 * names a person with a subject and a display name and nothing else, because the subject is the only
 * identifier the two products share (KW-1 §9).
 */
function kiwiMemberName(member: KiwiMember): string {
  return member.displayName?.trim() || member.email || member.subject
}
