import { useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, type FilterItem, FilterPanel, Input, Skeleton } from "@jmouse/ui"
import { ExternalLink, Pencil, Upload } from "lucide-react"
import { CardGroup, PageCard } from "@/components/PageCard"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { PageHeader } from "@/components/PageHeader"
import { publicPageUrl, type PageSummary } from "@/api/pages"
import { useCreatePage, useDeletePage, usePages, useUploadPage } from "@/hooks/usePages"
import { useFolders } from "@/hooks/useFolders"
import { describeQueryFailure } from "@/lib/loadFailure"
import { groupHues } from "@/lib/groupHues"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Pages — this product's own Markdown documents, listed as a library.
 *
 * <h2>The shape is the one the old interface had, the parts are this one's</h2>
 *
 * A rail of folders on the left, cards grouped by folder on the right, a search over titles and
 * excerpts, and two ways to start a page — write one, or upload a `.md`. Nothing came across from the
 * legacy screen's markup: the cards are `EntityCard` through {@link PageCard}, the rail is the library's
 * `FilterPanel`, and the density is the one preference every card grid in this interface obeys.
 *
 * <h2>⚠️ A page belongs to a person; a workspace is somewhere it was shared</h2>
 *
 * That is why this screen never sends a workspace id and never re-fetches when the active workspace
 * changes. The server scopes the listing from the request it already has, and the folder rail is the
 * *owner's* tree — the same tree whichever workspace is open.
 *
 * <h2>⚠️ A failure is not an empty library</h2>
 *
 * `query.data` is empty in both cases, and the two want opposite reactions from the reader: one says
 * write something, the other says try again or tell somebody. They are told apart here before anything
 * is drawn — see {@link LoadFailureNotice}.
 */
export function PagesPage() {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const fileInput = useRef<HTMLInputElement>(null)

  const pagesQuery = usePages()
  const foldersQuery = useFolders()
  const createPage = useCreatePage()
  const uploadPage = useUploadPage()
  const deletePage = useDeletePage()

  const pages = pagesQuery.data ?? []
  const folders = foldersQuery.data ?? []
  const failure = describeQueryFailure(pagesQuery, "page")

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const searched = term
      ? pages.filter(
          (page) => page.title.toLowerCase().includes(term) || (page.excerpt ?? "").toLowerCase().includes(term),
        )
      : pages

    return activeFolderId ? searched.filter((page) => page.categoryId === activeFolderId) : searched
  }, [pages, search, activeFolderId])

  // ⚠️ Folders arrive in nested-set order, so grouping in tree order costs nothing but following them.
  // The ungrouped run goes last, which is where a reader looks for the things nobody has filed.
  const groups = useMemo(() => {
    const byFolder = new Map<string, PageSummary[]>()
    const unfiled: PageSummary[] = []
    const known = new Set(folders.map((folder) => folder.id))

    for (const page of visible) {
      if (page.categoryId && known.has(page.categoryId)) {
        byFolder.set(page.categoryId, [...(byFolder.get(page.categoryId) ?? []), page])
      } else {
        unfiled.push(page)
      }
    }

    const filed = folders
      .filter((folder) => byFolder.has(folder.id))
      .map((folder) => ({
        key: folder.id,
        title: folder.name,
        icon: folder.icon,
        pages: byFolder.get(folder.id)!,
      }))

    return unfiled.length > 0
      ? [...filed, { key: "unfiled", title: "Unfiled", icon: null, pages: unfiled }]
      : filed
  }, [visible, folders])

  // Position, not a hash of the name — a group keeps its colour as long as it keeps its place, so the
  // rail does not repaint itself every time somebody types into the search box.
  const hueOfGroup = useMemo(() => groupHues(groups.map((group) => group.key)), [groups])

  const filterItems: FilterItem[] = folders.map((folder) => ({
    key: folder.id,
    icon: folder.icon ?? "▸",
    label: folder.name,
    depth: folder.depth,
    count: pages.filter((page) => page.categoryId === folder.id).length,
  }))

  function openPage(pageId: string) {
    navigate(spaceSectionPath(spaceSlug ?? "", `pages/${pageId}`))
  }

  function startPage() {
    createPage.mutate(
      { title: "Untitled page", categoryId: activeFolderId, contentMarkdown: "" },
      {
        onSuccess: (page) => openPage(page.id),
        onError: () => toast.error("Could not create the page."),
      },
    )
  }

  function uploadMarkdown(file: File) {
    uploadPage.mutate(
      { file, categoryId: activeFolderId ?? undefined },
      {
        onSuccess: (page) => {
          toast.success(`${page.title} uploaded.`)
          openPage(page.id)
        },
        onError: () => toast.error("Could not read that file as a page."),
      },
    )
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Markdown documents, filed in folders and shared into workspaces"
        actions={
          <>
            <Input
              size="sm"
              className="w-56"
              value={search}
              placeholder="Search pages…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <CardDensityToggle />

            {/* ⚠️ The value is cleared after every pick: choosing the same file twice in a row fires no
                change event otherwise, and the second upload silently does nothing. */}
            <input
              ref={fileInput}
              type="file"
              accept=".md,text/markdown"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  uploadMarkdown(file)
                }

                event.target.value = ""
              }}
            />
            <Button size="sm" variant="outline" disabled={uploadPage.isPending} onClick={() => fileInput.current?.click()}>
              <Upload className="size-3.5" /> Upload .md
            </Button>
            <Button size="sm" disabled={createPage.isPending} onClick={startPage}>
              New page
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Folders"
          items={filterItems}
          activeKey={activeFolderId}
          onSelect={setActiveFolderId}
          allLabel="All pages"
          allIcon="▦"
          allCount={pages.length}
        />

        <div className="flex min-w-0 flex-col gap-5">
          {failure ? (
            <LoadFailureNotice failure={failure} onRetry={() => pagesQuery.refetch()} />
          ) : pagesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                📄
              </span>
              <span className="text-sm font-medium">{pages.length === 0 ? "No pages yet" : "Nothing matches"}</span>
              <span className="max-w-md text-xs text-muted-foreground">
                {pages.length === 0
                  ? "A page is a Markdown document — a note, a procedure, a datasheet with live numbers in it. Write one, or upload a .md file you already have."
                  : "Nothing here matches that search, in this folder."}
              </span>
              {pages.length === 0 && (
                <Button size="sm" className="mt-2" disabled={createPage.isPending} onClick={startPage}>
                  New page
                </Button>
              )}
            </div>
          ) : (
            groups.map((group) => (
              <CardGroup
                key={group.key}
                title={group.title}
                icon={group.icon}
                count={group.pages.length}
                hue={hueOfGroup.get(group.key)}
              >
                {group.pages.map((page) => (
                  <PageLibraryCard
                    key={page.id}
                    page={page}
                    onOpen={() => openPage(page.id)}
                    onDelete={() =>
                      deletePage.mutate(page.id, {
                        onSuccess: () => toast.success(`${page.title} deleted.`),
                        onError: () => toast.error("Could not delete this page."),
                      })
                    }
                  />
                ))}
              </CardGroup>
            ))
          )}
        </div>
      </div>
    </>
  )
}

/**
 * One page in the grid.
 *
 * ⚠️ **Two badges, and they answer different questions.** The status says whether the page is finished;
 * the visibility says whether a stranger can read it. A single badge folding them together is how a
 * draft ends up looking private when it is published to the whole internet.
 */
function PageLibraryCard({
  page,
  onOpen,
  onDelete,
}: {
  page: PageSummary
  onOpen: () => void
  onDelete: () => void
}) {
  const isPublished = page.status === "PUBLISHED"
  const isPublic = page.visibility === "PUBLIC"
  // ⚠️ `shareToken` arrives as undefined rather than null when there is none — non-null serialisation.
  const publicAddress = isPublic && page.shareToken ? publicPageUrl(page.shareToken) : null

  return (
    <PageCard
      icon={page.title[0]?.toUpperCase() ?? "¶"}
      panelCount={new Date(page.updatedAt).toLocaleDateString()}
      name={page.title}
      isDraft={!isPublished}
      badge={
        <Badge variant={isPublished ? "default" : "outline"}>
          {page.status.charAt(0) + page.status.slice(1).toLowerCase()}
        </Badge>
      }
      description={page.excerpt || "No content yet."}
      chips={<Badge variant={isPublic ? "default" : "secondary"}>{isPublic ? "🌐 Public" : "🔒 Private"}</Badge>}
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={onOpen}>
            <Pencil className="size-3" /> Open
          </Button>
          {publicAddress && (
            <Button size="sm" variant="ghost" asChild>
              <a href={publicAddress} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3" /> Public
              </a>
            </Button>
          )}
        </>
      }
      onOpen={onOpen}
      onDelete={onDelete}
      confirmMessage={`Delete ${page.title}?`}
    />
  )
}
