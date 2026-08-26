import { useParams } from "react-router-dom"
import { Button, Skeleton } from "@jmouse/ui"
import { EntryRecord } from "@/components/form/EntryRecord"
import { PoweredBy, PublicAccessError, PublicSurface } from "@/components/public/PublicSurface"
import { usePublicEntry, usePublicEntryForm } from "@/hooks/usePublic"

/**
 * One record somebody was handed a link to.
 *
 * ⚠️ **The row and the form it belongs to are two requests, and both are needed to draw anything.** A
 * record is a map of field *names* to written values; without the form there are no labels, no order and
 * no units. So there is no partial rendering here — either both arrive or the screen says the link did
 * not resolve.
 */
export function PublicEntryPage({ shareToken: given }: { shareToken?: string } = {}) {
  const parameters = useParams<{ shareToken: string }>()
  const shareToken = given ?? parameters.shareToken

  const { data: entry, isLoading: entryLoading, isError } = usePublicEntry(shareToken)
  const { data: form, isLoading: formLoading } = usePublicEntryForm(shareToken)

  if (entryLoading || formLoading) {
    return (
      <PublicSurface>
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PublicSurface>
    )
  }

  if (isError || !entry || !form) {
    return (
      <PublicAccessError what="record" />
    )
  }

  return (
    <PublicSurface>
      <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {form.icon && (
              <span aria-hidden="true" className="text-lg">
                {form.icon}
              </span>
            )}
            <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">{form.name}</h1>
          </div>

          {/* ⚠️ A real navigation to the backend, not a fetch. The print view is a document the server
              renders; asking for it with XHR would land the HTML in a promise with nothing to do with it. */}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/public/entries/${shareToken}/print`} target="_blank" rel="noreferrer">
              Print
            </a>
          </Button>
        </div>

        <EntryRecord form={form} entry={entry} />
      </div>

      <PoweredBy />
    </PublicSurface>
  )
}
