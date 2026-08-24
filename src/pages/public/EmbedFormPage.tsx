import { useState } from "react"
import { useParams } from "react-router-dom"
import { Skeleton } from "@jmouse/ui"
import { DynamicForm } from "@/components/form/DynamicForm"
import { useEmbedFrame } from "@/components/public/useEmbedFrame"
import { useSubmitPublicEntry, usePublicForm } from "@/hooks/usePublic"
import { readFormConfigs } from "@/lib/formConfigs"
import { isFieldValidationError } from "@/lib/formValues"
import { problemDetailOf } from "@/lib/apiErrors"
import { surfaceScaleInSearch, surfaceScaleStyle } from "@/lib/surfaceScale"

/**
 * The same form, rendered inside somebody else's page.
 *
 * ⚠️ **No shell, no brand header, no card, no page background.** It is a rectangle on a site this
 * product does not control and has never seen — anything that reads like *our* chrome is chrome the host
 * did not ask for, sitting in the middle of their layout.
 *
 * ⚠️ **It measures itself and tells the parent.** See `useEmbedFrame` — an iframe that cannot report its
 * height is one that is always slightly the wrong size.
 *
 * ⚠️ **The scale comes from the URL, because the reader has no account here.** Whoever wrote the embed
 * code is the only person who can say how big it should be; `?scale=` is where they say so, and it is
 * clamped to the same ladder the application uses rather than trusted.
 */
export function EmbedFormPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const frame = useEmbedFrame()

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

      if (submission.successRedirectUrl) {
        window.location.href = submission.successRedirectUrl

        return
      }

      setSubmitted(true)
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const { title, detail } = problemDetailOf(error)

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

      // ⚠️ Shown here rather than thrown. The old embed re-threw everything that was not a 409, which
      // reached the global toast — a toast that renders inside a 400px iframe on somebody else's page,
      // where it is either clipped or covering the form it is complaining about.
      setFailure(detail ?? title)
    }
  }

  return (
    <div
      ref={frame}
      className="scaled-surface flex flex-col gap-3 bg-background p-4"
      style={surfaceScaleStyle(surfaceScaleInSearch(window.location.search))}
    >
      {isLoading && <Skeleton className="h-40 w-full" />}

      {isError && <EmbedNotice icon="🔒">This form is no longer available.</EmbedNotice>}

      {closedReason && <EmbedNotice icon="🚫">{closedReason}</EmbedNotice>}

      {submitted && (
        <EmbedNotice icon="✅">{submission.successMessage ?? "Your response has been recorded."}</EmbedNotice>
      )}

      {form && !submitted && !closedReason && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {form.icon && (
                <span aria-hidden="true" className="text-lg">
                  {form.icon}
                </span>
              )}
              <h1 className="font-display text-base font-semibold tracking-[-0.02em]">{form.name}</h1>
            </div>
            {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
          </div>

          {failure && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {failure}
            </p>
          )}

          <DynamicForm
            form={form}
            onSubmit={submit}
            submitLabel={submission.buttonText ?? "Submit"}
            isSubmitting={submitEntry.isPending}
          />
        </>
      )}

      {/* ⚠️ `target="_blank"`: the embed IS the whole document of its frame, so an ordinary link would
          replace the form with Innoventa's landing page inside the host's rectangle. */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-[11px] text-muted-foreground hover:text-foreground"
      >
        Powered by Innoventa
      </a>
    </div>
  )
}

function EmbedNotice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border p-6 text-center">
      <span aria-hidden="true" className="text-2xl">
        {icon}
      </span>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
