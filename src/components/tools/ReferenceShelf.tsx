import { useState } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import {
  Button,
  type FilterItem,
  FilterPanel,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@jmouse/ui"
import { CardGroup, PageCard } from "@/components/PageCard"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { publicKiwiSurface } from "@/components/markdown/surface"
import {
  getManualPage,
  getManualPagesIn,
  getReferenceShelf,
  withoutRepeatedTitle,
  type ManualSection,
} from "@/api/manual"

/**
 * Reference pages, drawn beside the instruments (INVT-0118).
 *
 * <h2>⚠️ Why these are here and not in the manual</h2>
 *
 * They were written as pages and are granted like pages, so the first version of the manual showed them
 * as its first chapter — a folder of electronics calculators standing where a book's opening should be,
 * with no direct pages in it, which is what made `/manual` open on *"pick a page"*. Nobody reads them
 * front to back: they are instruments, and this is where somebody looking for one looks.
 *
 * <h2>⚠️ Read through the public, republished path, from inside a signed-in screen</h2>
 *
 * The pages come from `/api/public/kiwi`, anonymously, exactly as the manual does — **not** from Kiwi
 * directly with the reader's Identity token like the Pages screen. That is deliberate: this material is
 * already published to the world, and asking somebody to connect a second identity to read a resistor
 * formula would be charging them for something that is free.
 *
 * <h2>⚠️ The tab disappears rather than apologising</h2>
 *
 * An installation with no reference branch configured, or one whose branch was never granted, gets a
 * 404 — and the caller draws no tab at all. An empty shelf explaining itself is worse than a screen that
 * simply does not claim to have one.
 */
export function ReferenceShelf({ shelf }: { shelf: ManualSection }) {
  // ⚠️ `null` means EVERY chapter, and it is the default. It used to mean "fall back to the first",
  // which left the filter's own "All" row selecting nothing anybody could see — a control that has to
  // be clicked to discover it does nothing.
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [openAddress, setOpenAddress] = useState<string | null>(null)

  const chapters = shelf.children

  // ⚠️ One request per chapter, and that is the honest cost of the "All" view: the backend answers a
  // section's contents per section, so there is no single call that returns the shelf. It is bounded by
  // the number of chapters — five here — which is why the control is worth having rather than removing.
  const perChapter = useQueries({
    queries: chapters.map((chapter) => ({
      queryKey: ["manual-pages", chapter.id],
      queryFn: () => getManualPagesIn(chapter.id),
      retry: false,
    })),
  })

  const filterItems: FilterItem[] = chapters.map((chapter, index) => ({
    key: chapter.id,
    icon: "🧮",
    label: chapter.name,
    count: perChapter[index]?.data?.length,
  }))

  const groups = chapters
    .map((chapter, index) => ({ chapter, pages: perChapter[index]?.data ?? [] }))
    .filter((group) => activeChapterId === null || group.chapter.id === activeChapterId)
    .filter((group) => group.pages.length > 0)

  const isLoading = perChapter.some((query) => query.isLoading)

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Chapter"
          items={filterItems}
          activeKey={activeChapterId}
          onSelect={setActiveChapterId}
          allLabel="Every chapter"
          allIcon="📘"
          allCount={perChapter.reduce((total, query) => total + (query.data?.length ?? 0), 0)}
        />

        <div className="flex min-w-0 flex-col gap-5">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                📘
              </span>
              <span className="text-sm font-medium">Nothing filed here</span>
              <span className="max-w-md text-xs text-muted-foreground">
                A chapter is allowed to be a heading with its pages one level down — and what is on this
                shelf at all is decided in Kiwi rather than in this product.
              </span>
            </div>
          ) : (
            groups.map((group) => (
              <CardGroup key={group.chapter.id} title={group.chapter.name} icon="🧮" count={group.pages.length}>
                {group.pages.map((page) => (
                  <PageCard
                    key={page.address}
                    icon="🧮"
                    name={page.title}
                    description={page.excerpt}
                    onOpen={() => setOpenAddress(page.address)}
                    actions={
                      <Button variant="ghost" size="sm" onClick={() => setOpenAddress(page.address)}>
                        Open
                      </Button>
                    }
                  />
                ))}
              </CardGroup>
            ))
          )}
        </div>
      </div>

      {openAddress && <ReferenceSheet address={openAddress} onClose={() => setOpenAddress(null)} />}
    </>
  )
}

/**
 * One reference page, opened.
 *
 * ⚠️ **The same sheet shape the instruments use**, deliberately: a person opening a calculator should
 * not be able to tell from the interaction whether it was written in this repository or in Kiwi. Where
 * it came from is a fact about the deployment, not about the answer.
 */
function ReferenceSheet({ address, onClose }: { address: string; onClose: () => void }) {
  const page = useQuery({
    queryKey: ["manual-page", address],
    queryFn: () => getManualPage(address),
    retry: false,
  })

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">{page.data?.title ?? "Reference"}</SheetTitle>
          {page.data?.writtenBy && (
            <SheetDescription className="text-xs">Written by {page.data.writtenBy}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {page.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : page.isError || !page.data ? (
            <p className="text-sm text-muted-foreground">This page cannot be shown right now.</p>
          ) : (
            // ⚠️ publicKiwi, not APP_SURFACE: the document came from the public route, so its live
            // blocks must resolve against the copy the server itself fetched (INVT-0093). Asking the
            // signed-in route would match directives against a document nobody vouched for.
            <PageMarkdown
              markdown={withoutRepeatedTitle(page.data.contentMarkdown, page.data.title)}
              surface={publicKiwiSurface(page.data.address)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** The shelf, or null where the installation has none. ⚠️ A 404 is an answer here, not a failure. */
export function useReferenceShelf() {
  return useQuery({
    queryKey: ["reference-shelf"],
    queryFn: getReferenceShelf,
    retry: false,
  })
}
