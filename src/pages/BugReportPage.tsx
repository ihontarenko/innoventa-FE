import { PageHeader } from "@/components/PageHeader"
import { EmbedHost } from "@/components/public/EmbedHost"

/**
 * Reporting a bug — which is Innoventa's own public form, embedded in Innoventa.
 *
 * ⚠️ **It eats its own embed, and that is the point rather than a shortcut.** The bug report is a form
 * in a workspace like any other; giving it a bespoke screen would mean a second form renderer, a second
 * validation path and a second place submissions land. Embedding the public surface means this page is
 * six lines and the form is edited in the form builder by whoever wants a new field on it.
 *
 * ⚠️ **It is also the only continuous test of the embed contract.** The resize protocol has a sender and
 * a receiver, and nothing else in this product exercises both — a change that breaks the height message
 * shows up here, in-house, rather than on somebody else's website.
 */
export function BugReportPage() {
  return (
    <>
      <PageHeader title="Bug reports" description="Report a bug or unexpected behaviour in Innoventa" />

      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-lg border">
        <EmbedHost src="/_/form/bug-report-form/embed" title="Bug report form" />
      </div>
    </>
  )
}
