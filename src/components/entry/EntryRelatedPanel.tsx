import { useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ExternalLink, Link2, Plus, Trash2, X } from "lucide-react"
import { Badge, Button, Input, Skeleton } from "@jmouse/ui"
import { CAD_LINK_LABEL, RELATION_LABELS, type EntryLink } from "@/api/entryLinks"
import { useEntryLinks, useLinkEntries, useUnlinkEntries } from "@/hooks/useEntryLinks"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useEntriesByPurpose } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FormEntry } from "@/types"

/**
 * What this record is to another record — a pair, a complement, a replacement.
 *
 * ⚠️ **A relation, not a field.** Two resistors chosen to be matched, an NPN and the PNP that mirrors
 * it, a part and the one that supersedes it: none of these is an answer somebody types into the record,
 * and writing one as a text field means the other record never knows about it. The link table is
 * symmetric, so saying it once says it from both sides — which is the whole reason to have one.
 *
 * ⚠️ **Every link EXCEPT a drawing's.** A part is attached to the symbol and footprint it is drawn as
 * through this same table, and reading all of them would offer a footprint as something to use instead
 * of the part. Nothing refuses that — a list of links looks like a list of links — so this filter is the
 * only thing between a correct list and a wrong answer. It **excludes** rather than allowing, because
 * the label is nullable and an allow-list would silently drop every link written before labels existed.
 */
export function EntryRelatedPanel({
  entry,
  purposeCode,
}: {
  entry: FormEntry
  /** What may be offered in the picker. ⚠️ Same purpose only — a shelf row pairs with a shelf row. */
  purposeCode: string | null
}) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const { data: links = [], isLoading } = useEntryLinks(entry.id)
  const unlink = useUnlinkEntries()

  const [picking, setPicking] = useState(false)

  const related = links.filter((link) => link.label !== CAD_LINK_LABEL)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            Related records
            {related.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {related.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Pairs, complements and replacements — said once and true from both ends.
          </p>
        </div>

        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setPicking(true)}>
          <Plus className="size-3.5" />
          Link a record
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : related.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing linked yet. A matched pair, the opposite polarity, the part that replaces this one — any
          of those is a link rather than a note somebody has to remember to write on both records.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {related.map((link) => (
            <RelatedRow
              key={link.id}
              link={link}
              spaceSlug={spaceSlug}
              busy={unlink.isPending}
              onRemove={() =>
                unlink.mutate(
                  { entryId: entry.id, targetEntryId: link.linkedEntryId, linkId: link.id },
                  {
                    onSuccess: () => toast.success("Unlinked."),
                    onError: () => toast.error("That was not unlinked."),
                  },
                )
              }
            />
          ))}
        </ul>
      )}

      {picking && (
        <RecordPicker
          entry={entry}
          purposeCode={purposeCode}
          linkedIds={links.map((link) => link.linkedEntryId)}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}

function RelatedRow({
  link,
  spaceSlug,
  busy,
  onRemove,
}: {
  link: EntryLink
  spaceSlug: string | null
  busy: boolean
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Link2 className="size-3.5" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{link.linkedEntryTitle}</span>
        <span className="truncate text-[11px] text-muted-foreground">{link.linkedFormName}</span>
      </div>

      {/* ⚠️ A label is nullable — a link written before labels existed says nothing about what it is,
          and inventing a word for it would be this screen making the record up. */}
      {link.label && (
        <Badge variant="secondary" className="shrink-0">
          {link.label}
        </Badge>
      )}

      {/* ⚠️ **The address is form-and-entry, not entry alone.** There is no route that takes a bare entry
          id — a row is addressed through the form it belongs to, and a link built from the id by itself
          resolves to nothing while looking entirely reasonable in the source. */}
      {spaceSlug && (
        <Button asChild variant="ghost" size="icon-sm" className="shrink-0">
          <Link
            to={spaceSectionPath(spaceSlug, `entry/${link.linkedFormId}/${link.linkedEntryId}`)}
            title="Open it"
            aria-label="Open it"
          >
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        disabled={busy}
        title="Unlink"
        aria-label="Unlink"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  )
}

/**
 * Choosing the record at the other end, and saying what the two are to each other.
 *
 * ⚠️ **The label is offered, not enforced.** The column is free text and older rows carry none, so a
 * closed list here would be a validation the database never agreed to — the suggestions fill the box,
 * and anything typed is accepted.
 */
function RecordPicker({
  entry,
  purposeCode,
  linkedIds,
  onClose,
}: {
  entry: FormEntry
  purposeCode: string | null
  linkedIds: string[]
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [label, setLabel] = useState<string>(RELATION_LABELS[0])
  const debounced = useDebouncedValue(search, 250)
  const link = useLinkEntries()

  const { data: page, isLoading } = useEntriesByPurpose(purposeCode ?? undefined, 0, 25, {
    query: debounced.trim() || undefined,
  })

  /* ⚠️ Itself and everything already linked are dropped — a record linked to itself is a row nothing
     refuses and nothing can mean. */
  const offers = (page?.content ?? []).filter(
    (candidate) => candidate.id !== entry.id && !linkedIds.includes(candidate.id),
  )

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-medium">Link a record</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          className="min-w-40 flex-1"
          value={search}
          placeholder="Search this workspace…"
          onChange={(event) => setSearch(event.target.value)}
        />

        <Input
          size="sm"
          className="w-36"
          list="entry-relation-labels"
          value={label}
          placeholder="How they relate"
          onChange={(event) => setLabel(event.target.value)}
        />

        <datalist id="entry-relation-labels">
          {RELATION_LABELS.map((one) => (
            <option key={one} value={one} />
          ))}
        </datalist>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : offers.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-muted-foreground">
          Nothing else to link{search.trim() ? " matching that" : ""}.
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {offers.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                disabled={link.isPending}
                className="flex w-full items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left hover:border-primary"
                onClick={() =>
                  link.mutate(
                    { entryId: entry.id, targetEntryId: candidate.id, label: label.trim() || null },
                    {
                      onSuccess: () => {
                        toast.success("Linked.")
                        onClose()
                      },
                      onError: () => toast.error("That was not linked."),
                    },
                  )
                }
              >
                <span className="min-w-0 flex-1 truncate text-sm">{titleOf(candidate)}</span>
                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** ⚠️ Falls back to whatever the row happens to carry — a row with no name is still a row. */
function titleOf(candidate: FormEntry): string {
  return Object.values(candidate.fieldValues ?? {}).find(Boolean) ?? "—"
}
