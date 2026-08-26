import { useParams } from "react-router-dom"
import { Skeleton } from "@jmouse/ui"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { FormBuilder } from "@/components/form/builder/FormBuilder"
import { useForm } from "@/hooks/useForms"
import { describeQueryFailure } from "@/lib/loadFailure"

/**
 * The form builder — an ordinary screen, like every other one.
 *
 * ⚠️ **It used to be a workbench in a bordered box that filled the frame**, with three columns
 * scrolling independently and a header of its own invention. That is gone (Ivan, 2026-08-25: *«лейаут
 * не в загальному стилі»*): the builder carries the standard `PageHeader`, its questions flow in the
 * layout's own scroller, and the preview column that forced the shape is a button now.
 */
export function FormBuilderPage() {
  const { formId } = useParams()
  const query = useForm(formId)
  const failure = describeQueryFailure(query, "form")

  // ⚠️ **The failure is asked about before the wait, not after.** This page used to say "did not load,
  // or it is not one you can reach" for every outcome at once — so a 500 read as a permission problem
  // and sent whoever hit it to the access screen instead of to the backend log. `INVT-0109`.
  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  if (!query.data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return <FormBuilder form={query.data} />
}
