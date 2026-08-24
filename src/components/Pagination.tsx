import { Button } from "@jmouse/ui"

/**
 * Where in a long result somebody is.
 *
 * ⚠️ **The total is stated, not implied.** A page of fifty that looks like the whole list is how somebody
 * concludes an event never happened — which, on an audit log, is the one wrong conclusion that matters.
 */
export function Pagination({
  page,
  totalPages,
  totalElements,
  size,
  onChange,
}: {
  page: number
  totalPages: number
  totalElements: number
  size: number
  onChange: (page: number) => void
}) {
  if (totalElements === 0) {
    return null
  }

  const first = page * size + 1
  const last = Math.min((page + 1) * size, totalElements)

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        {first}–{last} of {totalElements.toLocaleString()}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
          ‹ Previous
        </Button>
        <span className="font-mono text-muted-foreground">
          {page + 1} / {Math.max(totalPages, 1)}
        </span>
        <Button variant="ghost" size="sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
          Next ›
        </Button>
      </div>
    </div>
  )
}
