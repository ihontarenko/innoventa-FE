import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Skeleton } from "@jmouse/ui"
import { FormPreview } from "@/components/form/builder/FormPreview"
import { useForm } from "@/hooks/useForms"

/**
 * The form, as the person filling it in will meet it — in a window, from wherever you happen to be.
 *
 * ⚠️ **A dialog rather than a second pane** (Ivan, 2026-08-25). A preview is worth looking at from the
 * library, from the management screen and from the builder alike, and only the builder has a column to
 * spare. Asked for as a *button* everywhere, it costs nothing where there is no room.
 *
 * ⚠️ **The same `FormPreview` the builder's pane draws**, which is the real `DynamicForm` — conditions,
 * phantom inference and the cascade that clears hidden answers all behave here because this is the thing
 * that implements them. Nothing typed into it is ever submitted.
 *
 * ⚠️ **It fetches the schema itself.** Every caller has a `FormSummary` and none of them has the fields;
 * threading a detail through a library row, a card and a management pane would make three screens fetch
 * something only this window uses.
 */
export function FormPreviewDialog({ formId, onClose }: { formId: string; onClose: () => void }) {
  const { data: form } = useForm(formId)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[82svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-10">
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            {form?.icon && <span aria-hidden="true">{form.icon}</span>}
            {form?.name ?? "Preview"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Fill it in, try its conditions — nothing typed here is stored anywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          {form ? (
            <FormPreview form={form} withHeader={false} />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
