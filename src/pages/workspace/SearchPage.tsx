import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Badge, type FilterItem, Row, RowList, RowMeta, RowTitle } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { SearchModes } from "@/components/search/SearchModes"
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
    <ListScreen
      title="Search"
      description={
        isReady
          ? `${total} across ${activeDescriptor?.label.toLowerCase() ?? "everything"}`
          : "Forms, fields, entries, pages"
      }
      search={{ value: query, onChange: (value) => put("q", value), placeholder: "Search everything…" }}
      banner={<SearchModes />}
      rail={{
        title: "Kind",
        items: filterItems,
        activeKey: activeType,
        onSelect: (key) => put("type", key),
        allLabel: "Everything",
        allIcon: "⌕",
      }}
      loading={isReady && isFetching && hits.length === 0}
      /* ⚠️ **Two different nothings, and they must not read alike.** Too short a query is a state the
          person can leave by typing; no match is an answer. Folding them into one empty state would
          tell somebody who has typed one letter that they own nothing. */
      isEmpty={!isReady || hits.length === 0}
      empty={
        !isReady
          ? {
              title: "Type a little more",
              text: `At least ${MINIMUM_QUERY_LENGTH} characters — one letter matches most of what you own, which is the slowest and least useful answer there is.`,
            }
          : {
              title: "Nothing matches",
              text: `Nothing answers to “${query}”${activeDescriptor ? ` among ${activeDescriptor.label.toLowerCase()}` : ""}. Try fewer words, or widen the kind.`,
            }
      }
      pagination={
        data
          ? {
              page,
              totalPages: data.totalPages,
              totalElements: data.totalElements,
              size: data.size,
              onChange: setPage,
            }
          : undefined
      }
    >
      <div className="p-4">
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
      </div>
    </ListScreen>
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

    // A page has an address of its own again — this product stores them, and the screen that opens one
    // is a workspace route like an entry's.
    case "page":
      return spaceSectionPath(spaceSlug, `pages/${hit.id}`)

    default:
      return null
  }
}
