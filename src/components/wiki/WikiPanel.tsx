import { useEffect, useState } from "react"
import { AlertTriangle, BookOpen, ExternalLink, KeyRound, Plus, Search } from "lucide-react"
import { Alert, AlertDescription, Button, Input, Skeleton } from "@jmouse/ui"
import { WikiDocument } from "@/components/wiki/WikiDocument"
import { WikiTree } from "@/components/wiki/WikiTree"
import { connectIdentity, hasIdentityConnection } from "@/auth/identityAuth"
import { useQuery } from "@tanstack/react-query"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useKiwiPage, useKiwiWiki } from "@/hooks/useKiwiWiki"

/**
 * The workspace's wiki: a tree beside a document — **read and written in Kiwi** (INVT-0121).
 *
 * <h2>⚠️ Innoventa stopped owning pages, and this screen is what replaced the store</h2>
 *
 * The browser calls Kiwi directly with the reader's own Identity token, and **Kiwi decides who may read
 * and write what** (`KW-1` §1). Innoventa's backend is not on this path at all — not a proxy, not a
 * relay, not a cache — which is the whole reason Kiwi can be the only authority: it sees the person,
 * not a product.
 *
 * <h2>⚠️ Every write control is offered, and none is guarded on a guess</h2>
 *
 * This screen used to offer a link to Kiwi instead of an editor, reasoning that writing was Kiwi's.
 * Access is Kiwi's; writing is not a separate thing to be withheld. Kiwi refuses a write it does not
 * allow, and the honest interface offers the control and repeats the refusal. Hiding a button on a
 * local guess reproduces Kiwi's rules here, badly, and the first time the two disagree the wrong one is
 * the invisible one.
 *
 * <h2>⚠️ Five states, and not one of them is a blank pane</h2>
 *
 * | The workspace… | What this draws |
 * |---|---|
 * | has no branch chosen | *"no wiki is configured"*, pointing at workspace settings |
 * | has one, this browser holds no Identity token | *"connect Identity"*, with the button |
 * | has one, Kiwi is unreachable | *"Kiwi is down"*, and stops |
 * | has one, the reader was not granted it | *"not yours to read"* — an answer, not a fault |
 * | has one, granted | the wiki |
 *
 * They are told apart **here, in one place**. An empty state reading *"you have no pages"* while Kiwi is
 * down is worse than an error: it is a plausible lie (`KW-1` §12), and somebody acts on it by going and
 * writing the wiki a second time.
 *
 * <h2>⚠️ Section management is absent, deliberately</h2>
 *
 * Creating, renaming, moving and deleting a section happen on **Kiwi's** screens, where the grants that
 * govern them are visible. Offering those here would mean offering somebody a button whose refusal this
 * product cannot explain.
 */
export function WikiPanel({
  kiwiRootCategoryId,
  canConfigure,
}: {
  /** The workspace's branch of Kiwi's tree, or null where nobody has chosen one (INVT-0120). */
  kiwiRootCategoryId: string | null
  /** Whether this reader can go and choose one — it changes the sentence, never the access. */
  canConfigure: boolean
}) {
  const [search, setSearch] = useState("")
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)

  // ⚠️ Asked of the BROWSER, never inferred from a failed request. Kiwi's category tree answers
  // 200-with-an-empty-array to an anonymous caller — an unauthenticated subject legitimately holds
  // nothing — so "you have not connected" and "nothing has been shared with you" arrive as the SAME
  // response. Guessing between them tells somebody their wiki is empty when one click would fill it.
  const connected = useQuery({ queryKey: ["identity-connection"], queryFn: hasIdentityConnection })

  const debouncedSearch = useDebouncedValue(search, 250)
  const wiki = useKiwiWiki(kiwiRootCategoryId, debouncedSearch, selectedSectionId)
  const page = useKiwiPage(selectedPageId)

  const pages = wiki.pages

  // Land on something readable rather than on an empty right-hand side: the first page in the list, and
  // a different one whenever what is selected has stopped existing (deleted, or filtered away by a
  // search). Only when nothing is selected — never overriding a choice somebody made.
  useEffect(() => {
    if (pages.length === 0) {
      setSelectedPageId(null)
      return
    }

    if (selectedPageId === null || !pages.some((candidate) => candidate.id === selectedPageId)) {
      setSelectedPageId(pages[0].id)
    }
  }, [pages, selectedPageId])

  if (kiwiRootCategoryId === null) {
    return (
      <Notice
        title="No wiki is configured"
        message={
          canConfigure
            ? "This workspace's pages live in Kiwi, and nobody has said which section of it they live in. Pick one under Settings → Wiki."
            : "This workspace's pages live in Kiwi, and nobody has said which section of it they live in yet. Somebody who administers the workspace can choose one."
        }
      />
    )
  }

  // ⚠️ Identity before everything else, because it is the only one of these the reader can fix — and
  // because an unconnected browser is indistinguishable from an empty wiki in `query.data`.
  if (connected.data === false) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-12 text-center">
        <KeyRound className="mx-auto size-6 opacity-70" />
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Connect Identity to read the pages</h2>
        <p className="text-sm text-muted-foreground">
          Pages live in Kiwi, which knows you by your Identity account rather than by the one you signed
          in with here. Connecting it changes nothing about this workspace — it lets your browser ask
          Kiwi directly, so Kiwi and not Innoventa decides what you may see.
        </p>
        <Button type="button" onClick={() => void connectIdentity(window.location.pathname)}>
          Connect Identity
        </Button>
      </div>
    )
  }

  // ⚠️ Before the loading check, not after it: a query that failed is not a query still loading, and
  // the order of these two branches is the difference between an honest error and a spinner forever.
  if (wiki.unreachable) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Kiwi is down or unreachable, so this workspace's pages cannot be drawn. Nothing is lost — the
          wiki is stored there, and this screen only reads it.
        </AlertDescription>
      </Alert>
    )
  }

  if (wiki.tree.isError || wiki.rootMissing) {
    // ⚠️ Not an error to the reader. Kiwi answering "not yours" about a section is a grant they have
    // not been given, which is somebody's job over there rather than a fault to report here.
    return (
      <Notice
        title="This wiki is not yours to read"
        message="The section this workspace's wiki lives in is in Kiwi, and you have not been granted it. Somebody who administers Kiwi's access can give it to you."
      />
    )
  }

  if (connected.isLoading || wiki.tree.isLoading || wiki.root === null) {
    return <Skeleton className="h-96 w-full" />
  }

  const root = wiki.root
  const writeInto = selectedSectionId ?? root.id

  function addPage() {
    const title = window.prompt("Title of the new page")

    if (title?.trim()) {
      // Into the section being looked at, so "new page" while reading a section lands there rather than
      // at the root — the only guess this screen makes, and the one everybody expects it to.
      wiki.addPage.mutate(
        { categoryId: writeInto, title: title.trim() },
        { onSuccess: (created) => setSelectedPageId(created.id) },
      )
    }
  }

  function removePage() {
    if (
      page.data &&
      window.confirm(`Delete “${page.data.title}”? Its revisions go with it — this is permanent.`)
    ) {
      wiki.removePage.mutate(page.data.id, { onSuccess: () => setSelectedPageId(null) })
    }
  }

  // ⚠️ `root.children.length === 0` is the load-bearing half, and it is not in Tessera's copy.
  // `pages` is what is filed DIRECTLY in the root, and a root is routinely a heading with its pages
  // one level down — the imported manual is exactly that. Without this clause the screen announces
  // "this workspace has no wiki yet" over 132 pages, and offers to start a second one.
  if (
    pages.length === 0 &&
    root.children.length === 0 &&
    !debouncedSearch &&
    !wiki.pagesLoading
  ) {
    return (
      <Notice
        title="This workspace has no wiki yet"
        message="A wiki is for what is not a record — how this workspace is organised, a bring-up log, a procedure that outlived the job it was written for."
        action={
          <Button size="sm" className="mt-2" onClick={addPage}>
            <Plus className="size-4" />
            Write the first page
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <aside className="space-y-3 lg:border-r lg:pr-4">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 opacity-50" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the wiki…"
            className="pl-8"
          />
        </div>

        <Button size="sm" variant="outline" className="w-full justify-start" onClick={addPage}>
          <Plus className="size-4" />
          New page
        </Button>

        <WikiTree
          root={root}
          pages={pages}
          isSearching={wiki.isSearching}
          selectedPageId={selectedPageId}
          selectedSectionId={selectedSectionId}
          onSelectPage={setSelectedPageId}
          onSelectSection={setSelectedSectionId}
        />

        {/* Where the sections themselves are managed. ⚠️ A link rather than a control: this product
            cannot explain a refusal it did not make. */}
        <a
          href={`${window.location.protocol}//${window.location.hostname}:5070`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-2 pt-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          Manage sections in Kiwi
        </a>
      </aside>

      <section className="min-w-0">
        {selectedPageId === null ? (
          // An empty answer to a search is not an empty wiki — the pages are there, this slice of them
          // is not, and saying so beats a blank pane that reads as a failed load.
          <p className="rounded-lg border bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
            {debouncedSearch ? "No page mentions that." : "Pick a page from the list."}
          </p>
        ) : (
          <WikiDocument
            page={page.data}
            isLoading={page.isLoading}
            root={root}
            isSaving={wiki.savePage.isPending}
            onSave={(title, markdown) => wiki.savePage.mutate({ pageId: selectedPageId, title, markdown })}
            onFile={(categoryId) => wiki.filePage.mutate({ pageId: selectedPageId, categoryId })}
            onDelete={removePage}
          />
        )}
      </section>
    </div>
  )
}

/**
 * One of the four things that are not the wiki.
 *
 * ⚠️ **A local component rather than a shared `EmptyState`, because three of the four are not empty
 * states at all** — "not configured", "not granted" and "not connected" are answers about somebody's
 * decision, and only the fourth is genuinely *nothing here yet*. They share a shape because a reader
 * meets them in the same place, not because they mean the same thing.
 */
function Notice({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-md space-y-2 py-12 text-center">
      <BookOpen className="mx-auto size-6 opacity-70" />
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  )
}
