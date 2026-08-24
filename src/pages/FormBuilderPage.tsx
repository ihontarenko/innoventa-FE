import { useParams } from "react-router-dom"
import { Skeleton } from "@jmouse/ui"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { FormBuilder } from "@/components/form/builder/FormBuilder"
import { useForm } from "@/hooks/useForms"
import { describeQueryFailure } from "@/lib/loadFailure"

/**
 * The form builder, filling the frame.
 *
 * ⚠️ **`h-full` rather than `flex-1`, and it needs the layout's scroller to be bounded.** The builder is
 * a three-column workbench whose columns scroll independently; the moment its own height is allowed to
 * grow, the *page* scrolls instead and the field list leaves the top of the window while somebody edits
 * a long field. `ApplicationLayout` caps the frame at `h-svh` — that is what makes this line work.
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border">
      <FormBuilder form={query.data} />
    </div>
  )
}
