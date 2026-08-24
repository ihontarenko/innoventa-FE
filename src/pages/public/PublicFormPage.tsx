import { useState } from "react"
import { useParams } from "react-router-dom"
import { Button, Skeleton } from "@jmouse/ui"
import { DynamicForm } from "@/components/form/DynamicForm"
import { PoweredBy, PublicNotice, PublicSurface } from "@/components/public/PublicSurface"
import { useSubmitPublicEntry, usePublicForm } from "@/hooks/usePublic"
import { readFormConfigs } from "@/lib/formConfigs"
import { isFieldValidationError } from "@/lib/formValues"
import { problemDetailOf } from "@/lib/apiErrors"

/**
 * A form somebody was handed a link to.
 *
 * ⚠️ **The same `DynamicForm` the signed-in application uses.** Conditions, validation, virtual field
 * groups, every control — a second, simpler renderer for public forms is how a required field starts
 * being required in one place and not the other, and the place it stops being required is the one
 * strangers use.
 */
export function PublicFormPage({ shareToken: given }: { shareToken?: string } = {}) {
  const parameters = useParams<{ shareToken: string }>()
  const shareToken = given ?? parameters.shareToken

  const { data: form, isLoading, isError } = usePublicForm(shareToken)
  const submitEntry = useSubmitPublicEntry()

  const [submitted, setSubmitted] = useState(false)
  const [failure, setFailure] = useState("")
  const [closedReason, setClosedReason] = useState<string | null>(null)

  const { submission } = readFormConfigs(form?.config)

  async function submit(values: Record<string, string>) {
    setFailure("")

    try {
      await submitEntry.mutateAsync({ shareToken: shareToken!, fieldValues: values })

      // ⚠️ After the write, never before — a redirect that fires first takes the respondent away from a
      // form whose answer was never recorded, and neither of them ever finds out.
      if (submission.successRedirectUrl) {
        window.location.href = submission.successRedirectUrl

        return
      }

      setSubmitted(true)
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const { title, detail } = problemDetailOf(error)

      // ⚠️ 409 is the form saying it has stopped accepting answers — a different thing from a submission
      // that failed, and the only one where trying again is pointless.
      if (status === 409) {
        setClosedReason(detail ?? title)

        return
      }

      // ⚠️ A refusal that names fields belongs to the form, which is drawing this very submission.
      // Re-thrown so it reaches `DynamicForm`, where each message lands under the answer it is about —
      // the banner here would say "one or more fields did not pass validation" and leave the reader
      // hunting for which.
      if (isFieldValidationError(error)) {
        throw error
      }

      setFailure(detail ?? title)
    }
    // ⚠️ Deliberately not re-thrown: the global toast would say the same thing a second time, over a
    // message this screen has already placed exactly where the reader is looking.
  }

  return (
    <PublicSurface accentColour={submission.accentColour}>
      {isLoading && (
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {isError && (
        <PublicNotice icon="🔗" title="This form is not available">
          The link may have been revoked, or this form may have stopped accepting responses.
        </PublicNotice>
      )}

      {closedReason && (
        <PublicNotice icon="🚫" title="Submissions are closed">
          {closedReason}
        </PublicNotice>
      )}

      {submitted && form && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-background p-10 text-center">
          <span aria-hidden="true" className="text-3xl">
            ✅
          </span>
          <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">Response submitted</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {submission.successMessage ?? (
              <>
                Thank you for filling out <strong>{form.name}</strong>. Your response has been recorded.
              </>
            )}
          </p>

          {submission.allowResubmit && (
            <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>
              Submit another response
            </Button>
          )}
        </div>
      )}

      {form && !submitted && !closedReason && (
        <>
          <div className="flex flex-col gap-4 rounded-lg border bg-background p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                {form.icon && (
                  <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-muted text-xl">
                    {form.icon}
                  </span>
                )}
                <div className="flex flex-col gap-0.5">
                  <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">{form.name}</h1>
                  {form.purpose && (
                    <span className="text-xs text-muted-foreground">
                      {form.purpose.label}
                      {form.category ? ` · ${form.category.name}` : ""}
                    </span>
                  )}
                </div>
              </div>

              {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
            </div>

            <hr className="border-border" />

            {failure && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {failure}
              </p>
            )}

            <DynamicForm
              form={form}
              onSubmit={submit}
              submitLabel={submission.buttonText ?? "Submit response"}
              isSubmitting={submitEntry.isPending}
            />
          </div>

          <PoweredBy />
        </>
      )}
    </PublicSurface>
  )
}
