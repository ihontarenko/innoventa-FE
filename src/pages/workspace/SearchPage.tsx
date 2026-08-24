import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge, type FilterItem, FilterPanel, Input, Row, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { MINIMUM_QUERY_LENGTH, useSearch, useSearchTypes } from "@/hooks/useSearch"
import { normalizeValueForUI } from "@/lib/fieldValues"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { SearchHit } from "@/api/search"

/**
 * Everything, by name.
 *
 * ⚠️ **The query lives in the address, not in state.** A search worth running is a search worth sending
 * to somebody — and a screen that kept it in memory would answer a pasted link with an empty box.
 *
 * ⚠️ **The kinds come from the server.** A hit kind the backend adds appears here with its own label and
 * glyph and no frontend change; a hard-coded list would be a second copy of the index's own vocabulary,
 * drifting the moment either side grew something.
 */
export function SearchPage() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const [parameters, setParameters] = useSearchParams()

  const query = parameters.get("q") ?? ""
  const activeType = parameters.get("type")

  const [page, setPage] = useState(0)

  const { data: descriptors = [] } = useSearchTypes()
  const { data, isFetching } = useSearch(query, activeType ? [activeType] : undefined, page)

  // Narrowing or retyping starts over — page three of the old answer is not page three of the new one.
  useEffect(() => {
    setPage(0)
  }, [query, activeType])

  const hits = data?.content ?? []
  const total = data?.totalElements ?? 0
  const isReady = query.trim().length >= MINIMUM_QUERY_LENGTH

  function put(key: string, value: string | null) {
    setParameters(
      (previous) => {
        const next = new URLSearchParams(previous)

        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }

        return next
      },
      { replace: true },
    )
  }

  const filterItems: FilterItem[] = descriptors.map((descriptor) => ({
    key: descriptor.type,
    icon: descriptor.icon,
    label: descriptor.label,
  }))

  const activeDescriptor = descriptors.find((descriptor) => descriptor.type === activeType)

  return (
    <>
      <PageHeader
        title="Search"
        description={isReady ? `${total} across ${activeDescriptor?.label.toLowerCase() ?? "everything"}` : "Forms, fields, entries, pages"}
        actions={
          <Input
            autoFocus
            className="h-8 w-80 text-sm"
            value={query}
            placeholder="Search everything…"
            onChange={(event) => put("q", event.target.value)}
          />
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Kind"
          items={filterItems}
          activeKey={activeType}
          onSelect={(key) => put("type", key)}
          allLabel="Everything"
          allIcon="⌕"
        />

        <div className="flex min-w-0 flex-col gap-3">
          {!isReady ? (
            <Hint
              glyph="⌕"
              title="Type a little more"
              detail={`At least ${MINIMUM_QUERY_LENGTH} characters — one letter matches most of what you own, which is the slowest and least useful answer there is.`}
            />
          ) : isFetching && hits.length === 0 ? (
            <Skeleton className="h-64 w-full" />
          ) : hits.length === 0 ? (
            <Hint
              glyph="📭"
              title="Nothing matches"
              detail={`Nothing answers to “${query}”${activeDescriptor ? ` among ${activeDescriptor.label.toLowerCase()}` : ""}. Try fewer words, or widen the kind.`}
            />
          ) : (
            <>
              <RowList>
                {hits.map((hit) => {
                  const descriptor = descriptors.find((one) => one.type === hit.type)
                  const href = spaceSlug ? addressOf(hit, spaceSlug) : null

                  return (
                    <Row
                      key={`${hit.type}-${hit.id}`}
                      onOpen={href ? () => navigate(href) : undefined}
                      leading={<span aria-hidden="true">{descriptor?.icon ?? "•"}</span>}
                      trailing={descriptor ? <Badge variant="outline">{descriptor.label}</Badge> : undefined}
                    >
                      {/* ⚠️ An entry's title is a stored *value* and goes through the normaliser, or a
                          composite reads as `22|pF` in the one list somebody scans fastest. */}
                      <RowTitle>{hit.type === "entry" ? normalizeValueForUI(hit.title) : hit.title}</RowTitle>
                      {hit.subtitle && <RowMeta>{hit.subtitle}</RowMeta>}
                    </Row>
                  )
                })}
              </RowList>

              {data && data.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  totalElements={data.totalElements}
                  size={data.size}
                  onChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Hint({ glyph, title, detail }: { glyph: string; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        {glyph}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

/**
 * Where a hit lives.
 *
 * ⚠️ **Built here from the hit's own metadata, because the index does not know this product's routes.**
 * A kind with no address is not an error — it is a thing the search can find and this interface cannot
 * yet open, and returning `null` makes the row inert rather than sending somebody to a 404.
 */
function addressOf(hit: SearchHit, spaceSlug: string): string | null {
  switch (hit.type) {
    case "form":
      return spaceSectionPath(spaceSlug, `forms/${hit.id}`)

    case "field":
      return spaceSectionPath(spaceSlug, "fields")

    case "entry": {
      const formId = hit.metadata["formId"]

      return formId ? spaceSectionPath(spaceSlug, `entry/${formId}/${hit.id}`) : null
    }

    // ⚠️ Pages are moving to Kiwi (`KW-13`), so there is deliberately no address for one yet — a link
    // built now would point at a screen that is about to stop existing.
    case "page":
      return null

    default:
      return null
  }
}
