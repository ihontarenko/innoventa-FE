import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2, X } from "lucide-react"
import { Badge, Button, Input, Skeleton, cn } from "@jmouse/ui"
import { useAttachDrawing, useCadAttachments, useDetachDrawing } from "@/hooks/useCadAttachments"
import { useEntriesByPurpose } from "@/hooks/useWorkspaceForms"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { CadAttachment } from "@/api/cad"
import type { FormEntry } from "@/types"

const CAD_PURPOSE = "CAD"

const SYMBOL = "SYMBOL"
const FOOTPRINT = "FOOTPRINT"
const MODEL_3D = "MODEL_3D"

/** What each stored kind is called, so a row says what it is rather than what it is coded as. */
const KIND_LABELS: Record<string, string> = {
  [SYMBOL]: "Symbol",
  [FOOTPRINT]: "Footprint",
  [MODEL_3D]: "3D body",
}

/**
 * What a thing is drawn as, what a drawing is made of, and what uses it.
 *
 * ⚠️ **One relation, read from whichever end you are standing at.** The link table is symmetric and
 * stores each pair once, so a part shows its footprint and that footprint shows the part — neither side
 * is stored twice. Drawing only one of those teaches half a model, and the half nobody sees is the one
 * that answers *is it safe to change this*.
 *
 * ⚠️ **Which is exactly why the two directions are told apart here.** Symmetry means a footprint's list
 * holds both the parts that use it and the 3D body it references, and rendering them together would read
 * as though the body used the footprint. They are split by the link's own `outgoing` flag.
 *
 * ⚠️ **Splitting on what sits at the far end was tried and is WRONG.** "A CAD record is something this
 * uses; anything else uses this" reads correctly from a part and backwards from a drawing — because from
 * a drawing the far end is a CAD record too. It shipped, and a 3D body listed the footprint that places
 * it as something the body itself used. Direction is a property of the link, not of its ends.
 *
 * ⚠️ **An empty section still says something.** One that disappears when it is empty reads as a feature
 * this workspace does not have.
 */
export function CadAttachmentsPanel({
  entryId,
  drawingKind,
  entryTitle,
}: {
  entryId: string
  /**
   * The `cad_kind` of the record being looked at, when it is itself a drawing.
   *
   * ⚠️ **The kind, not a boolean.** Whether Attach is offered here — and what it may offer — depends on
   * *which* drawing this is: a footprint references a 3D body, a symbol references nothing.
   */
  drawingKind?: string | null
  entryTitle?: string
}) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const [picking, setPicking] = useState(false)

  const { data: attachments = [], isLoading } = useCadAttachments(entryId)
  const detach = useDetachDrawing()

  /**
   * ⚠️ **Direction comes from the LINK, never from what is at the far end.**
   *
   * The first version of this split on "is the far end a CAD record" — and that reads correctly from a
   * part, where it is, and backwards from a drawing, where the thing at the far end is a CAD record
   * too. A footprint and the 3D body it places are both drawings, so the far end tells you nothing:
   * the body listed the footprint as something *it* used.
   *
   * `outgoing` is the link's own answer — this entry is the source, so the far end is what it points
   * at. It is the one fact a symmetric table cannot reconstruct afterwards, which is why the backend
   * had to start saying it.
   */
  const uses = attachments.filter((attachment) => attachment.outgoing)
  const usedBy = attachments.filter((attachment) => !attachment.outgoing)

  const isDrawing = Boolean(drawingKind)

  /**
   * What may be attached from here, and nothing when the answer is nothing.
   *
   * ⚠️ **From a part, any drawing; from a FOOTPRINT, only a 3D body.** In KiCad the 3D model belongs to
   * the footprint — the footprint carries the path to it — so the footprint is where somebody would say
   * so. An unfiltered picker there would offer it another footprint, which means nothing.
   *
   * ⚠️ And a drawing is never attached *to a part* from the drawing's side: one footprint serves hundreds
   * of them, so that is a list somebody would work through from the wrong end.
   */
  const offers: string | null = !isDrawing ? "any" : drawingKind === FOOTPRINT ? MODEL_3D : null

  function detachOne(attachment: CadAttachment) {
    return detach
      .mutateAsync({ linkId: attachment.id, entryId, drawingEntryId: attachment.linkedEntryId })
      .then(() => toast.success("Detached"))
      .catch(() => toast.error("Could not detach that — nothing was changed."))
  }

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-4">
      {/*
        ⚠️ Drawn only when there is something in it or something to put in it. A symbol points at
        nothing and a 3D body points at nothing — an empty "Uses" on either would promise a relation
        those kinds do not have.
      */}
      {(offers || uses.length > 0) && (
        <Relation
          heading={isDrawing ? "Uses" : "Drawn as"}
          blurb={
            isDrawing
              ? "The 3D body this footprint places."
              : "The symbol, footprint and 3D body this is placed as."
          }
          empty={
            isDrawing
              ? "No 3D body attached — the footprint places a flat outline until one is."
              : "No drawing attached yet — a symbol or footprint attached here is what a CAD tool places this as."
          }
          attachments={uses}
          spaceSlug={spaceSlug}
          onDetach={detachOne}
          busy={detach.isPending}
          loading={isLoading}
          action={
            offers ? (
              <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
                <Plus className="mr-1 size-3.5" />
                Attach
              </Button>
            ) : undefined
          }
        />
      )}

      {/*
        ⚠️ Only on a drawing. On a part this list is always empty — a part linked to a part is an
        alternate, and those carry a different label and never reach this panel — so drawing it there
        would be an empty section promising a relation that cannot exist.
      */}
      {isDrawing && (
        <Relation
          heading="Used by"
          blurb="The parts, stock and drawings this one is attached to."
          empty="Nothing uses this drawing yet."
          attachments={usedBy}
          spaceSlug={spaceSlug}
          onDetach={detachOne}
          busy={detach.isPending}
          loading={isLoading}
        />
      )}

      {picking && offers && (
        <DrawingPicker
          entryId={entryId}
          entryTitle={entryTitle}
          onlyKind={offers === "any" ? null : offers}
          attachedIds={attachments.map((attachment) => attachment.linkedEntryId)}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  )
}

/** One direction of the relation, drawn the same way whichever direction it is. */
function Relation({
  heading,
  blurb,
  empty,
  attachments,
  spaceSlug,
  onDetach,
  busy,
  action,
  loading,
}: {
  heading: string
  blurb: string
  empty: string
  attachments: CadAttachment[]
  spaceSlug: string | null
  onDetach: (attachment: CadAttachment) => void
  busy: boolean
  action?: ReactNode
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            {heading}
            {attachments.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {attachments.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
        {action}
      </header>

      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : attachments.length === 0 ? (
        <p className="rounded border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-xs">{attachment.linkedEntryTitle}</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {attachment.linkedFormName}
                </span>
              </div>

              {/*
                ⚠️ **The address is form-and-entry, not entry alone.** There is no route that takes a bare
                entry id — a row is addressed through the form it belongs to, and a link built from the id
                by itself resolves to nothing while looking entirely reasonable in the source.
              */}
              {spaceSlug && (
                <Link
                  to={spaceSectionPath(
                    spaceSlug,
                    `entry/${attachment.linkedFormId}/${attachment.linkedEntryId}`,
                  )}
                  className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  Open
                </Link>
              )}

              {/*
                ⚠️ Always rendered, never revealed on hover. A control that only exists under a pointer
                does not exist at all on a touch screen — it is absent rather than small.
              */}
              <Button
                size="icon"
                variant="ghost"
                className="size-6 shrink-0"
                aria-label={`Detach ${attachment.linkedEntryTitle}`}
                disabled={busy}
                onClick={() => onDetach(attachment)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Choosing a drawing to attach.
 *
 * ⚠️ **The identifier is what is shown, not the name.** A footprint is matched character for character
 * against libraries on somebody's own disk, so `SOT-23-5` and `SOT-23-6` differ by the one character a
 * friendly label would hide. Everything else on the row is secondary to that string.
 */
function DrawingPicker({
  entryId,
  entryTitle,
  onlyKind,
  attachedIds,
  onClose,
}: {
  entryId: string
  entryTitle?: string
  /** Narrow to one kind — a footprint may only take a 3D body — or null for any. */
  onlyKind: string | null
  attachedIds: string[]
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const debounced = useDebouncedValue(search, 250)

  const attach = useAttachDrawing()

  /*
    ⚠️ **A generous page, because the kind is filtered here in the browser.** Filtering a page of twenty
    and then paging it shows a page that is mostly empty and a "next" that skips rows. A workspace holds
    tens of drawings rather than thousands — one footprint serving hundreds of parts is the whole reason
    this catalogue is worth having — so one page and a search box is honest at that size. A workspace
    that outgrows it needs the kind as a server-side filter, and that is its own ticket.
  */
  const { data: page, isLoading } = useEntriesByPurpose(CAD_PURPOSE, 0, 200, { query: debounced })

  const candidates = (page?.content ?? [])
    .filter((entry) => !attachedIds.includes(entry.id))
    .filter((entry) => (onlyKind ? kindValueOf(entry) === onlyKind : true))

  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={onlyKind ? "Search 3D bodies…" : "Search symbols, footprints, bodies…"}
          className="h-8 text-xs"
        />
        <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Close" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {entryTitle && (
        <p className="text-[11px] text-muted-foreground">
          Attaching to <span className="font-mono">{entryTitle}</span>
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : candidates.length === 0 ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">
          {debounced
            ? "Nothing matches that."
            : onlyKind
              ? "This workspace has no 3D bodies yet — add one in Catalogs first."
              : "This workspace has no CAD records yet — add one in Catalogs first."}
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                disabled={attach.isPending}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left",
                  "hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                )}
                onClick={() =>
                  attach
                    .mutateAsync({ entryId, drawingEntryId: candidate.id })
                    .then(() => {
                      toast.success("Attached")
                      onClose()
                    })
                    .catch(() => toast.error("Could not attach that — nothing was changed."))
                }
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {identifierOf(candidate)}
                </span>
                {kindLabelOf(candidate) && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {kindLabelOf(candidate)}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function identifierOf(entry: FormEntry) {
  return entry.fieldValues?.cad_identifier ?? "‹no identifier›"
}

function kindValueOf(entry: FormEntry) {
  return entry.fieldValues?.cad_kind ?? null
}

function kindLabelOf(entry: FormEntry) {
  const stored = kindValueOf(entry)
  return stored ? (KIND_LABELS[stored] ?? stored) : null
}
