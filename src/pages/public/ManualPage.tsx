import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, ChevronDown, ChevronRight, FileText, PlugZap } from "lucide-react"
import { Alert, AlertDescription, Skeleton, cn } from "@jmouse/ui"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { publicKiwiSurface } from "@/components/markdown/surface"
import {
  flattenManual,
  getManualEditions,
  getManualPage,
  getManualPagesIn,
  isManualUnavailable,
  manualPathTo,
  withoutRepeatedTitle,
  type ManualSection,
} from "@/api/manual"

/**
 * The manual — public, anonymous, and **read out of Kiwi** (INVT-0116, INVT-0118; `KW-13`, `KW-1` §10).
 *
 * <h2>⚠️ The one Kiwi-backed screen that asks the reader for nothing</h2>
 *
 * No account, no Identity connection, no token. The pages live in Kiwi, but **Innoventa reads them as
 * itself** — a product holding `@CATEGORY` grants — and serves them from its own address. So the browser
 * never talks to Kiwi, and Kiwi does not have to be reachable from wherever the visitor is.
 *
 * ⚠️ That is also the accepted risk `KW-1` §10 names, working in the useful direction: **the manual does
 * not have to be public in Kiwi at all.** It stays closed there and is public here.
 *
 * <h2>⚠️ One book with editions — not one tree of everything granted</h2>
 *
 * This drew every branch Innoventa held, and it was wrong in two visible ways: the Ukrainian manual
 * appeared as a sibling chapter of the English one, and a folder of electronics calculators appeared as
 * the book's first chapter — a heading with no direct pages, which is what made the screen open on
 * *"pick a page"* over a manual of 132 of them.
 *
 * <p>⚠️ **A translation is a separate tree and a language switcher, not a chapter.** The language rides
 * in `?language=`, so a link to the Ukrainian manual is still Ukrainian when somebody sends it on.
 *
 * <h2>⚠️ Three states, and the empty one is not an error</h2>
 *
 * | | |
 * |---|---|
 * | Kiwi unreachable | *"this manual cannot be shown right now"* — the backend answers 503 for it |
 * | nothing published | *"nothing has been published yet"*, which is true and is somebody's decision |
 * | a page nobody published | 404, indistinguishable from one that never existed |
 *
 * <h2>⚠️ Read-only, on purpose</h2>
 *
 * No editing, no comments, no history: all three need a reader Kiwi can identify, and this path has
 * none. The signed-in screen is `INVT-0097`, and it is a different screen for that reason rather than by
 * omission.
 */
export function ManualPage() {
  const { address } = useParams<{ address?: string }>()
  const [searchParameters, setSearchParameters] = useSearchParams()
  const navigate = useNavigate()
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  // ⚠️ Once the reader has opened a chapter themselves, the walk below stops for good — otherwise it
  // would move them out of a chapter they deliberately opened just because it happens to be empty.
  const [hasChosen, setHasChosen] = useState(false)

  const editions = useQuery({
    queryKey: ["manual-editions"],
    queryFn: getManualEditions,
    // A visitor should get one honest sentence rather than three attempts at the same outage.
    retry: false,
  })

  const available = editions.data ?? []
  const requested = searchParameters.get("language")
  const edition = available.find((candidate) => candidate.language === requested) ?? available[0] ?? null

  // ⚠️ The chapters, not the root — the root is the book's own heading and holds nothing directly.
  const chapters: ManualSection[] = edition ? edition.root.children : []
  const ordered = flattenManual(chapters).map(({ section }) => section)
  const currentSectionId = openSectionId ?? ordered[0]?.id ?? null
  const openPath = manualPathTo(chapters, currentSectionId)

  const pages = useQuery({
    queryKey: ["manual-pages", currentSectionId],
    queryFn: () => getManualPagesIn(currentSectionId as string),
    enabled: currentSectionId !== null,
    retry: false,
  })

  const page = useQuery({
    queryKey: ["manual-page", address],
    queryFn: () => getManualPage(address as string),
    enabled: Boolean(address),
    retry: false,
  })

  /**
   * Open the manual on a page rather than on an invitation to choose.
   *
   * ⚠️ **It walks, because a chapter is allowed to be a heading with nothing directly in it.** An empty
   * answer advances to the next section in reading order instead of stopping there.
   *
   * ⚠️ Only while the reader arrived with no address and has opened nothing themselves; a link to a
   * page is never overridden, and neither is a chapter somebody chose.
   */
  useEffect(() => {
    if (address || hasChosen || !pages.isSuccess) {
      return
    }

    const listed = pages.data ?? []

    if (listed.length > 0) {
      navigate(`/manual/${listed[0].address}${window.location.search}`, { replace: true })
      return
    }

    const next = ordered[ordered.findIndex((section) => section.id === currentSectionId) + 1]

    if (next) {
      setOpenSectionId(next.id)
    }
  }, [address, hasChosen, pages.isSuccess, pages.data, currentSectionId, ordered, navigate])

  /**
   * Switch edition.
   *
   * ⚠️ **It goes back to `/manual`, dropping the address.** The two editions are separate trees with
   * separate addresses (`KW-1` §7) — the Ukrainian translation of a page is a different page, and
   * nothing in either payload says which. Keeping the address would 404 every switch; landing on the
   * edition's first chapter is the honest answer until Kiwi carries a translation link.
   */
  function switchTo(language: string) {
    setOpenSectionId(null)
    setHasChosen(false)
    setSearchParameters({ language })
    navigate(`/manual?language=${language}`, { replace: true })
  }

  if (editions.isLoading) {
    return <Skeleton className="mx-auto mt-16 h-64 w-full max-w-5xl" />
  }

  if (editions.isError) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Alert variant="destructive">
          <PlugZap className="size-4" />
          <AlertDescription>
            {isManualUnavailable(editions.error)
              ? "This manual cannot be shown right now. Nothing is lost — it is stored elsewhere and this page only reads it."
              : "The manual could not be loaded."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!edition) {
    return (
      <div className="mx-auto max-w-xl space-y-2 px-6 py-16 text-center">
        <BookOpen className="mx-auto size-6 opacity-70" />
        <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">Nothing has been published yet</h1>
        <p className="text-sm text-muted-foreground">
          The manual lives in Kiwi, and none of it has been opened to the public. That is a decision
          somebody makes there rather than something to fix here.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <aside className="space-y-1 lg:sticky lg:top-10 lg:self-start">
        <h1 className="font-display text-base font-semibold tracking-[-0.02em]">{edition.root.name}</h1>

        {/* ⚠️ Drawn only when there is more than one edition. A switcher offering a single language is a
            control that cannot do anything, and a reader has to click it to find that out. */}
        {available.length > 1 && (
          <div className="mb-3 flex gap-1 pt-2">
            {available.map((candidate) => (
              <button
                key={candidate.language}
                type="button"
                onClick={() => switchTo(candidate.language)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  candidate.language === edition.language
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        )}

        {chapters.map((section) => (
          <Chapter
            key={section.id}
            section={section}
            openPath={openPath}
            currentAddress={address ?? null}
            language={edition.language}
            onOpen={(sectionId) => {
              setHasChosen(true)
              setOpenSectionId(sectionId)
            }}
          />
        ))}
      </aside>

      <section className="min-w-0">
        {page.isLoading && address ? (
          <Skeleton className="h-64 w-full" />
        ) : page.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {isManualUnavailable(page.error)
                ? "This page cannot be shown right now."
                : "There is nothing at this address."}
            </AlertDescription>
          </Alert>
        ) : page.data ? (
          <article className="space-y-4">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">{page.data.title}</h2>
            {page.data.writtenBy && (
              <p className="text-xs text-muted-foreground">Written by {page.data.writtenBy}</p>
            )}
            {/* ⚠️ No asset rewriting here — the backend already pointed the file links back at Kiwi
                (TSSR-0101), because a public visitor runs none of our code.
                ⚠️ And the surface is publicKiwi, NOT APP_SURFACE: a live block here must resolve through
                Innoventa's public Kiwi route, where the allowlist is the document the server itself
                fetched (INVT-0093). The signed-in route would 401 every visitor and, worse, would be
                asking a private endpoint on behalf of nobody. */}
            <PageMarkdown
              markdown={withoutRepeatedTitle(page.data.contentMarkdown, page.data.title)}
              surface={publicKiwiSurface(page.data.address)}
            />
          </article>
        ) : (
          <p className="rounded-lg border bg-muted/20 px-3 py-10 text-center text-sm text-muted-foreground">
            Pick a page from the list.
          </p>
        )}
      </section>
    </div>
  )
}

/**
 * One chapter and its pages.
 *
 * ⚠️ **Only an open chapter's pages are drawn, because only they have been fetched.** The backend
 * answers a section's contents per section; asking for every branch at once would be one request per
 * node to draw a sidebar.
 */
function Chapter({
  section,
  openPath,
  currentAddress,
  language,
  onOpen,
}: {
  section: ManualSection
  /** Root → open section, so every ancestor draws expanded rather than only the deepest one. */
  openPath: string[]
  currentAddress: string | null
  /** ⚠️ Carried on every link, or following one silently switches the reader back to the default. */
  language: string
  onOpen: (sectionId: string) => void
}) {
  const isOpen = openPath.includes(section.id)
  const isCurrent = openPath[openPath.length - 1] === section.id

  const pages = useQuery({
    queryKey: ["manual-pages", section.id],
    queryFn: () => getManualPagesIn(section.id),
    enabled: isOpen,
    retry: false,
  })

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
          isCurrent ? "font-semibold" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        onClick={() => onOpen(section.id)}
      >
        {isOpen ? (
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 opacity-60" />
        )}
        <span className="truncate">{section.name}</span>
      </button>

      {isOpen && (
        <>
          {(pages.data ?? []).map((listed) => (
            <Link
              key={listed.address}
              to={`/manual/${listed.address}?language=${language}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md py-1.5 pr-2 pl-8 text-[13px] no-underline transition-colors",
                listed.address === currentAddress
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <FileText className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{listed.title}</span>
            </Link>
          ))}

          {section.children.map((child) => (
            <div key={child.id} className="pl-3">
              <Chapter
                section={child}
                openPath={openPath}
                currentAddress={currentAddress}
                language={language}
                onOpen={onOpen}
              />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
