import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ExternalLink, Pencil, Search } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  cn,
} from "@jmouse/ui"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { DynamicForm } from "@/components/form/DynamicForm"
import { EntryRecord } from "@/components/form/EntryRecord"
import { CadAttachmentsPanel } from "@/components/cad/CadAttachmentsPanel"
import { EntryLookupDialog } from "@/components/lookup/EntryLookupDialog"
import { useForm } from "@/hooks/useForms"
import { readableMoment } from "@/lib/dates"
import { isFieldValidationError } from "@/lib/formValues"
import { describeQueryFailure } from "@/lib/loadFailure"
import type { FormEntry } from "@/types"

/**
 * One row of a form — read, or filled in.
 *
 * ⚠️ **A drawer rather than a page, and the list stays on screen.** Somebody working through a
 * component type's rows opens one, reads it, closes it and opens the next; a page would lose their place
 * every time.
 *
 * ⚠️ **Except when the row does not exist yet — then it is a modal.** Adding has no place in a list to
 * preserve, it is entirely what somebody came for, and a narrow strip is a poor room for a form of forty
 * fields. Same body, same footer, same write path; a different container for a different act.
 *
 * ⚠️ **The container is now the CALLER's choice, not a consequence of whether the row exists.** A list
 * whose rows open their own page has no drawer left to want: its rows carry an Edit control instead, and
 * what that opens is a form somebody came to fill in — the modal case, over a row that already exists.
 * `container` names it outright rather than making callers infer it from `isNew`, which is a different
 * question that happens to have had the same answer.
 *
 * ⚠️ **Reading and editing are two states of one surface, not two components.** The values are the same
 * values and the schema is the same schema — two implementations is how a field renders one way in the
 * list and another way in the editor, and nobody can say which is the record.
 *
 * ⚠️ **The schema is fetched, never taken from the summary.** A list carries a form's name and a field
 * count; rendering a form needs its fields, its conditions and its config, and a drawer that guessed
 * would draw an empty form for every type with more than nothing in it.
 */
export function EntryDetailDrawer({
  formId,
  entry,
  formName,
  initialValues,
  initialOptionLabels,
  isNew = false,
  isSubmitting = false,
  permalink,
  container,
  startInEdit,
  onSubmit,
  onDelete,
  onClose,
}: {
  formId: string
  /**
   * Centred over the screen, or a panel at the edge.
   *
   * ⚠️ **Left unset it keeps the old rule** — a modal for a row being added, a drawer for one being
   * read — so no existing caller changes behaviour. Name it when the surface underneath is not a list
   * somebody is working down, because that is the only thing a drawer is better at.
   */
  container?: "dialog" | "sheet"
  /**
   * Open straight into the editor rather than into the record.
   *
   * ⚠️ **Only ever set by a control that SAYS it edits.** An existing row opening in edit is how
   * somebody changes a value they meant to look at — which is why this is off unless a caller asks, and
   * why the caller that asks is an Edit button rather than a row click.
   */
  startInEdit?: boolean
  /**
   * The row's own address, when it has one.
   *
   * ⚠️ **A link, not a navigation.** Somebody working down a list wants the drawer; somebody who needs to
   * *quote* this row wants an address they can paste. Offering the second without taking away the first
   * is the whole reason this is a link in the header rather than a button that closes the drawer.
   */
  permalink?: string
  /** Absent for a row that does not exist yet. */
  entry?: FormEntry | null
  /**
   * What a NEW row starts with.
   *
   * ⚠️ **Only read when there is no entry.** An existing row.s answers are its own; letting a caller
   * seed them would be a silent edit of something somebody opened to look at.
   */
  initialValues?: Record<string, string>
  /**
   * What those seeded answers are CALLED, per field — `{ fieldName: { storedValue: label } }`.
   *
   * ⚠️ **A sourced select cannot name its own stored value.** Its choices are fetched only while the
   * picker is open, so a value that arrives already chosen has no label to print and renders as a
   * tombstone — the record is right there on screen and the form says it was deleted. The caller that
   * seeded the value is the one that knows what it is called, so it hands the name over with it.
   */
  initialOptionLabels?: Record<string, Record<string, string>>
  /** What the list already knows, so the header has a name before the schema lands. */
  formName?: string
  isNew?: boolean
  isSubmitting?: boolean
  onSubmit: (values: Record<string, string>) => Promise<void>
  /** ⚠️ Offered only while reading. A delete beside a Save is a delete somebody reaches for by mistake. */
  onDelete?: () => void
  onClose: () => void
}) {
  const schemaQuery = useForm(formId)
  const form = schemaQuery.data

  /**
   * ⚠️ **The schema failing is its own state, not a longer wait.** Without this the body kept the
   * skeleton for good while the footer offered a live "Add it" — a drawer inviting somebody to submit a
   * form that was never drawn. `INVT-0109`.
   */
  const schemaFailure = describeQueryFailure(schemaQuery, "form")

  // ⚠️ A new row opens in edit; an existing one opens in read, unless the control that opened it was
  // itself an Edit. Opening an existing row in edit *by default* is how somebody changes a value they
  // only meant to look at.
  const [editing, setEditing] = useState(startInEdit ?? isNew)

  // ⚠️ The old rule is the fallback, so a caller that names nothing behaves exactly as it always did.
  const asDialog = container ? container === "dialog" : isNew
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const [isLookingUp, setLookingUp] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  /**
   * Whether asking a distributor about this row means anything.
   *
   * ⚠️ **By PURPOSE, not by whether the form maps anything.** Gating on a `catalogue.*` key was tried and
   * is wrong twice over: a type that maps nothing is exactly the one whose owner has not discovered the
   * feature, and *reading* a distributor's answer — the price, the stock, the datasheet — is worth
   * having with nothing to apply it to. The dialog says what can and cannot land; the button says the
   * question can be asked at all.
   *
   * ⚠️ A holder form or a feedback form is not a part, so the question is not offered there.
   */
  const canLookUp = form?.purpose?.code === "INVENTORY" || form?.purpose?.code === "CATALOG"

  async function submit(values: Record<string, string>) {
    try {
      await onSubmit(values)
      setEditing(false)
    } catch (error) {
      // ⚠️ A refusal that names fields belongs to the form, which is still waiting for it one frame
      // up the stack. Catching it here is what left a rejected submission with a toast and not one red
      // control — the server said which answers were wrong and nobody drew them.
      if (isFieldValidationError(error)) {
        throw error
      }

      toast.error("That was not saved.")
    }
  }

  /* ⚠️ **The way to the full page is a BUTTON in the footer, not a link in the header.** It used to be
     a small grey line beside the title, which reads as a caption rather than as somewhere to go — and
     it sat next to the ✕, where a miss closes the record instead of opening it. In the footer it is
     the same size and the same shape as Edit, which is the other thing somebody does from here. */
  const heading = (
    <>
      {form?.name ?? formName ?? "Entry"}
      {isNew && <Badge variant="secondary">new</Badge>}
    </>
  )

  const blurb = isNew
    ? "Nothing is recorded until this is submitted."
    : entry
      ? `Recorded ${readableMoment(entry.createdAt)}${
          entry.updatedAt !== entry.createdAt ? ` · changed ${readableMoment(entry.updatedAt)}` : ""
        }`
      : "One row of this form."

  const body = (
    <>
        {/* ⚠️ The reading side sits on a tint and the editing side does not. A record is a stack of
            cards and needs something behind them to read as cards at all; a form is one surface and a
            tint behind its inputs only makes them look disabled. */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4",
            !editing && "bg-muted/20",
          )}
        >
          {schemaFailure ? (
            <LoadFailureNotice failure={schemaFailure} onRetry={() => void schemaQuery.refetch()} />
          ) : !form ? (
            <Skeleton className="h-64 w-full" />
          ) : editing ? (
            <DynamicForm
              form={form}
              initialValues={entry?.fieldValues ?? initialValues ?? {}}
              /* ⚠️ Without these a sourced select prints a tombstone for a value it holds perfectly well
                 — on an existing row as much as on a seeded new one. The labels are resolved server-side
                 precisely because the browser has no way to work them out. */
              optionLabels={entry?.optionLabels ?? initialOptionLabels ?? {}}
              onSubmit={submit}
              isSubmitting={isSubmitting}
              formRef={formRef}
              hideSubmitButton
            />
          ) : entry ? (
            <>
              {/* ⚠️ The same spec sheet the record page shows, one column wide. Two read views over one
                  row is how a field comes to render one way in a drawer and another way on a page, with
                  nobody able to say which is the record. */}
              <EntryRecord form={form} entry={entry} dense />

              {/* ⚠️ **Below the fields, and never inside them.** What a row IS and what it is ATTACHED TO
                  are different questions, and a relation rendered as one more field reads as a value
                  somebody typed. It shows on every row deliberately — a bin with no catalogue part is
                  exactly the case that needs a drawing of its own, so hiding this on anything but a part
                  would hide it where it matters most. */}
              <CadAttachmentsPanel
                entryId={entry.id}
                drawingKind={form.purpose?.code === "CAD" ? (entry.fieldValues?.cad_kind ?? null) : null}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing recorded.</p>
          )}
        </div>

        {/* ⚠️ The footer is outside the scroller. A form of forty fields whose Save has scrolled off the
            bottom is a form people stop finding the Save on. */}
        <div className="flex items-center gap-2 border-t p-4">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={isNew ? onClose : () => setEditing(false)}>
                Cancel
              </Button>
              <div className="flex-1" />
              {/* ⚠️ Inert until the schema is in hand. A submit over a body that never rendered would
                  post an empty row and call it a record. */}
              <Button size="sm" disabled={isSubmitting || !form} onClick={() => formRef.current?.requestSubmit()}>
                {isNew ? "Add it" : "Save changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>

              {onDelete &&
                (confirmingRemoval ? (
                  <Button variant="destructive" size="sm" onClick={onDelete}>
                    Really delete
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmingRemoval(true)}
                  >
                    Delete
                  </Button>
                ))}

              <div className="flex-1" />

              {/* ⚠️ Offered on a part, whatever its type maps — see `canLookUp`. */}
              {canLookUp && entry && (
                <Button variant="outline" size="sm" disabled={!form} onClick={() => setLookingUp(true)}>
                  <Search className="size-3.5" />
                  Look up
                </Button>
              )}

              {permalink && entry && (
                <Button asChild variant="outline" size="sm">
                  <Link to={permalink}>
                    <ExternalLink className="size-3.5" />
                    Open in full page
                  </Link>
                </Button>
              )}

              <Button size="sm" disabled={!form} onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </>
          )}
        </div>
    </>
  )

  /*
    ⚠️ **Adding is a modal; reading is a drawer — and they are not the same act.**

    Reading happens *against a list*: somebody works down twenty rows, opens one, closes it, opens the
    next, and losing their place each time is the whole cost. That is what a side panel is for.

    Adding has no place to keep. It is entirely what somebody came for, and a narrow strip is a poor
    room for a form of forty fields — so it opens centred, and wider.

    ⚠️ One surface either way. The body and the footer above are written once and put in whichever
    container the act calls for; two implementations of "fill this in" is how a field comes to render
    one way here and another way there.
  */
  /* ⚠️ Rendered beside whichever container is chosen, never inside only one of them. It used to hang off
     the sheet alone, which was invisible while `isNew` was the only way to get a dialog — the moment an
     existing row could open in one, pressing Look up there would have done nothing at all. */
  const lookupDialog = isLookingUp && entry && form && (
    <EntryLookupDialog
      entry={entry}
      form={form}
      isSaving={isSubmitting}
      onApply={async (values) => {
        await submit(values)
        setLookingUp(false)
      }}
      onClose={() => setLookingUp(false)}
    />
  )

  if (asDialog) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="flex max-h-[85vh] w-full flex-col gap-0 p-0 sm:max-w-2xl"
          /*
            ⚠️ **The backdrop does nothing, and Escape still closes.** A click outside is the accident —
            a half-filled form must not vanish because somebody missed a field. Escape is deliberate:
            you press it, and a dialogue a keyboard cannot leave is its own defect.
          */
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="pr-10 p-4 pb-3">
            <DialogTitle className="flex flex-wrap items-center gap-2">{heading}</DialogTitle>
            <DialogDescription>{blurb}</DialogDescription>
          </DialogHeader>

          {body}
        </DialogContent>

        {lookupDialog}
      </Dialog>
    )
  }

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* ⚠️ `pr-10`: the sheet's own close button is positioned `top-4 right-4` over this corner, and
            the link below is `ml-auto` — without the inset the two land on top of each other and the ✕
            sits in the middle of the words. */}
        <SheetHeader className="pr-10">
          <SheetTitle className="flex flex-wrap items-center gap-2">{heading}</SheetTitle>
          <SheetDescription>{blurb}</SheetDescription>
        </SheetHeader>

        {body}
      </SheetContent>

      {/* ⚠️ Applying writes through the same `onSubmit` the form uses — one write path, so a value taken
          from a distributor is validated exactly as a typed one is. */}
      {lookupDialog}
    </Sheet>
  )
}

