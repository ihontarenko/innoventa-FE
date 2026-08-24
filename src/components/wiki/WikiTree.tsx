import { useState } from "react"
import { ChevronDown, ChevronRight, FileText, Lock } from "lucide-react"
import { cn } from "@jmouse/ui"
import type { KiwiCategoryNode, KiwiPageSummary } from "@/api/kiwi"

/**
 * The wiki's left-hand side: **Kiwi's** sections, and the pages in the one being looked at
 * (INVT-0121's anatomy, INVT-0121's source).
 *
 * <h2>⚠️ Read-only, and that is the architecture rather than a missing feature</h2>
 *
 * Every control that changed a section — rename, add subsection, move up and down, remove — is gone.
 * Kiwi owns its tree and its grants, so those live on Kiwi's own screens where the rules that govern
 * them can be seen. A consumer offering them would be offering a button whose refusal it cannot
 * explain, which is worse than not offering it at all.
 *
 * <h2>⚠️ One tree, and it is the section tree</h2>
 *
 * A page has no parent of its own, so nothing here nests a page under a page — a page is a leaf in a
 * section, and moving it is re-filing it.
 *
 * <h2>⚠️ A section a reader cannot see is drawn, greyed, and not clickable</h2>
 *
 * `readable: false` is a **breadcrumb** (KW-1 §4): an ancestor of a branch they were granted, carried
 * so the tree has a path down to it, with no slug, no contents and a count that means nothing. Hiding
 * it would make the tree look like it starts halfway down; drawing it as an ordinary section would
 * promise something that answers 403.
 */
export function WikiTree({
  root,
  pages,
  isSearching,
  selectedPageId,
  selectedSectionId,
  onSelectPage,
  onSelectSection,
}: {
  root: KiwiCategoryNode
  pages: KiwiPageSummary[]
  /** While searching the list is not one section's contents, so no section owns it. */
  isSearching: boolean
  selectedPageId: string | null
  selectedSectionId: string | null
  onSelectPage: (pageId: string) => void
  onSelectSection: (categoryId: string | null) => void
}) {
  if (isSearching) {
    return (
      <div className="space-y-1">
        <p className="px-2 py-1 text-xs text-muted-foreground">
          {pages.length === 1 ? "1 page found" : `${pages.length} pages found`}
        </p>
        <PageList pages={pages} depth={0} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <SectionBranch
        section={root}
        depth={0}
        pages={pages}
        selectedPageId={selectedPageId}
        selectedSectionId={selectedSectionId ?? root.id}
        onSelectPage={onSelectPage}
        onSelectSection={onSelectSection}
      />
    </div>
  )
}

/**
 * One section, its subsections, and — when it is the selected one — its pages.
 *
 * ⚠️ **Only the selected section's pages are drawn, because only they have been fetched.** Kiwi answers
 * a section's contents per section (`/categories/{id}/pages`); asking for every branch at once would be
 * one request per node to draw a sidebar. Collapsed state lives here rather than in the panel: it is per
 * branch and does not survive a reload.
 */
function SectionBranch({
  section,
  depth,
  pages,
  selectedPageId,
  selectedSectionId,
  onSelectPage,
  onSelectSection,
}: {
  section: KiwiCategoryNode
  depth: number
  pages: KiwiPageSummary[]
  selectedPageId: string | null
  selectedSectionId: string
  onSelectPage: (pageId: string) => void
  onSelectSection: (categoryId: string | null) => void
}) {
  const [open, setOpen] = useState(true)
  const isSelected = section.id === selectedSectionId

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1",
          section.readable ? "hover:bg-accent/50" : "opacity-60",
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          disabled={!section.readable}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-[13px] disabled:cursor-default"
          onClick={() => {
            setOpen((wasOpen) => (isSelected ? !wasOpen : true))
            onSelectSection(section.id)
          }}
        >
          {section.children.length > 0 ? (
            open ? (
              <ChevronDown className="size-3.5 shrink-0 opacity-60" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            )
          ) : (
            <span className="size-3.5 shrink-0" />
          )}

          <span className={cn("truncate", isSelected ? "font-semibold" : "font-medium")}>{section.name}</span>

          {/* ⚠️ A breadcrumb carries no count worth printing — its zero is "not told", not "empty". */}
          {section.readable ? (
            <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{section.itemCount}</span>
          ) : (
            <Lock className="ml-auto size-3 shrink-0 opacity-70" />
          )}
        </button>
      </div>

      {open && (
        <>
          {isSelected && (
            <PageList pages={pages} depth={depth + 1} selectedPageId={selectedPageId} onSelectPage={onSelectPage} />
          )}

          {section.children.map((child) => (
            <SectionBranch
              key={child.id}
              section={child}
              depth={depth + 1}
              pages={pages}
              selectedPageId={selectedPageId}
              selectedSectionId={selectedSectionId}
              onSelectPage={onSelectPage}
              onSelectSection={onSelectSection}
            />
          ))}
        </>
      )}
    </div>
  )
}

function PageList({
  pages,
  depth,
  selectedPageId,
  onSelectPage,
}: {
  pages: KiwiPageSummary[]
  depth: number
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
}) {
  return (
    <>
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          // The inverted active state Innoventa's sidebar uses, and the one every other list in this
          // product uses — a selected row is the accent, not a tint of it.
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors",
            page.id === selectedPageId
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 22}px` }}
          onClick={() => onSelectPage(page.id)}
        >
          <FileText className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{page.title}</span>
        </button>
      ))}
    </>
  )
}
