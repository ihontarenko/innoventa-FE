import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton } from "@jmouse/ui"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { DynamicForm } from "@/components/form/DynamicForm"
import { EntryRecord } from "@/components/form/EntryRecord"
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
  isNew = false,
  isSubmitting = false,
  permalink,
  onSubmit,
  onDelete,
  onClose,
}: {
  formId: string
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

  // ⚠️ A new row opens in edit; an existing one opens in read. Opening an existing row in edit is how
  // somebody changes a value they only meant to look at.
  const [editing, setEditing] = useState(isNew)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

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

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {form?.name ?? formName ?? "Entry"}
            {isNew && <Badge variant="secondary">new</Badge>}
            {permalink && !isNew && (
              <Link to={permalink} className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground">
                Open on its own page ↗
              </Link>
            )}
          </SheetTitle>
          <SheetDescription>
            {isNew
              ? "Nothing is recorded until this is submitted."
              : entry
                ? `Recorded ${readableMoment(entry.createdAt)}${
                    entry.updatedAt !== entry.createdAt ? ` · changed ${readableMoment(entry.updatedAt)}` : ""
                  }`
                : "One row of this form."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {schemaFailure ? (
            <LoadFailureNotice failure={schemaFailure} onRetry={() => void schemaQuery.refetch()} />
          ) : !form ? (
            <Skeleton className="h-64 w-full" />
          ) : editing ? (
            <DynamicForm
              form={form}
              initialValues={entry?.fieldValues ?? {}}
              onSubmit={submit}
              isSubmitting={isSubmitting}
              formRef={formRef}
              hideSubmitButton
            />
          ) : entry ? (
            /* ⚠️ The same spec sheet the record page shows, one column wide. Two read views over one row
               is how a field comes to render one way in a drawer and another way on a page, with nobody
               able to say which is the record. */
            <EntryRecord form={form} entry={entry} dense />
          ) : (
            <p className="text-xs text-muted-foreground">Nothing recorded.</p>
          )}
        </div>

        {/* ⚠️ The footer is outside the scroller. A form of forty fields whose Save has scrolled off the
            bottom is a form people stop finding the Save on. */}
        <div className="flex items-center gap-2 border-t p-4">
          {editing ? (
            <>
              <Button variant="outline" onClick={isNew ? onClose : () => setEditing(false)}>
                Cancel
              </Button>
              <div className="flex-1" />
              {/* ⚠️ Inert until the schema is in hand. A submit over a body that never rendered would
                  post an empty row and call it a record. */}
              <Button disabled={isSubmitting || !form} onClick={() => formRef.current?.requestSubmit()}>
                {isNew ? "Add it" : "Save changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
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
              <Button disabled={!form} onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

