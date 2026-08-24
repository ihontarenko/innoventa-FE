import { useRef } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@jmouse/ui"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { DynamicForm } from "@/components/form/DynamicForm"
import { useForm } from "@/hooks/useForms"
import { isFieldValidationError } from "@/lib/formValues"
import { describeQueryFailure } from "@/lib/loadFailure"

/**
 * A form, opened to be filled in and submitted.
 *
 * ⚠️ **A dialog rather than a drawer, and that is the whole point of it** (Ivan, 2026-08-21). Filling a
 * form in is not a thing somebody does *beside* the list — it is the thing they came to do, and a panel
 * sliding in from the edge leaves half the screen showing the list they have stopped reading. A modal
 * centres the one task and takes the width the fields actually need.
 *
 * ⚠️ **It cannot be dismissed by clicking away from it.** That is `DialogContent`'s default now rather
 * than anything this component asks for — see the note there. A half-filled form thrown away by a
 * misclick on the scrim is the accident the default exists to stop.
 *
 * ⚠️ **The schema is fetched, never taken from the summary.** A list carries a form's name and a field
 * count; rendering a form needs its fields, its conditions and its config, and a dialog that guessed
 * would draw an empty form for every form with more than nothing in it.
 *
 * ⚠️ **Only submission lives here.** Reading a row that already exists, and editing it, are
 * `EntryDetailDrawer`'s — somebody working down a list of rows wants the list to stay on screen, which
 * is the case a drawer is right for and this one is not.
 */
export function EntryFormDialog({
  formId,
  formName,
  submitLabel = "Add it",
  isSubmitting = false,
  onSubmit,
  onClose,
}: {
  formId: string
  /** What the list already knows, so the header has a name before the schema lands. */
  formName?: string
  submitLabel?: string
  isSubmitting?: boolean
  onSubmit: (values: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const schemaQuery = useForm(formId)
  const form = schemaQuery.data

  /**
   * ⚠️ **The schema failing is its own state, not a longer wait.** Without it the body keeps a skeleton
   * for good while the footer offers a live submit — a dialog inviting somebody to send a form that was
   * never drawn (`INVT-0109`).
   */
  const schemaFailure = describeQueryFailure(schemaQuery, "form")

  const formRef = useRef<HTMLFormElement | null>(null)

  const isDraft = form ? form.status !== "ACTIVE" : false

  async function submit(values: Record<string, string>) {
    try {
      await onSubmit(values)
    } catch (error) {
      // ⚠️ A refusal that names fields belongs to the form, which is still waiting for it one frame up
      // the stack. Swallowing it here is what leaves a rejected submission with a toast and not one red
      // control — the server said which answers were wrong and nobody drew them.
      if (isFieldValidationError(error)) {
        throw error
      }

      toast.error("That was not saved.")
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6 text-base">
            {form?.icon && <span aria-hidden="true">{form.icon}</span>}
            {form?.name ?? formName ?? "Form"}
            {isDraft && <Badge variant="outline">Draft</Badge>}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {/* ⚠️ A draft says so here rather than being refused. A schema still being written is exactly
                what somebody wants to try filling in — but an answer recorded against it is answers to
                questions that may change afterwards, and that is worth one sentence. */}
            {isDraft
              ? "This form is still a draft — its fields may still change. Nothing is recorded until this is submitted."
              : "Nothing is recorded until this is submitted."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {schemaFailure ? (
            <LoadFailureNotice failure={schemaFailure} onRetry={() => void schemaQuery.refetch()} />
          ) : !form ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <DynamicForm form={form} onSubmit={submit} isSubmitting={isSubmitting} formRef={formRef} hideSubmitButton />
          )}
        </div>

        {/* ⚠️ The footer is outside the scroller. A form of forty fields whose submit has scrolled off the
            bottom is a form people stop finding the submit on. */}
        <div className="flex shrink-0 items-center gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex-1" />
          {/* ⚠️ Inert until the schema is in hand. A submit over a body that never rendered would post an
              empty answer and call it a record. */}
          <Button disabled={isSubmitting || !form} onClick={() => formRef.current?.requestSubmit()}>
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
