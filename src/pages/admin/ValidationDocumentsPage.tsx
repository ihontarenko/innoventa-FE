import {
  ValidationDocuments,
  ValidationTransportProvider,
  type DocumentUsage,
  type StoredDocument,
} from "@jmouse/validation"
import { PageHeader } from "@/components/PageHeader"
import {
  detachFormFromDocument,
  readBoundForms,
  validationTransport,
} from "@/lib/validationTransport"

/**
 * Every `.jmv` validation document in this installation, mounted.
 *
 * ## ⚠️ The screen is the library's; this file is the mounting and what only Innoventa can answer
 *
 * A validation document is about a jMouse *language*, so the list, the editor, the create and the
 * delete live in `@jmouse/validation` and every product that wants them takes the same screen. Three
 * things belong here and nowhere else: which client the requests go through, **who points at a
 * document**, and how to take one off it.
 *
 * ## ⚠️ Usage is supplied because the database cannot answer it
 *
 * `validation_documents` is the library's and has no foreign key into `form_configs` — deliberately.
 * So nothing refuses a delete that strands a form, and the screen refuses it instead, on the strength
 * of what `readBoundForms` reports. Passing no `usage` at all would leave the screen honest but blind:
 * it says *"anything still pointing at it will refuse records"* rather than showing a count nobody
 * computed.
 *
 * ## ⚠️ It fills the page rather than sitting in a centred column
 *
 * The screen is a rail of documents beside the one that is open, and both halves want the height they
 * are given — a `max-w-5xl` wrapper put a rules editor in a 64rem strip with the rest of a 1440px
 * screen left blank, which is the defect `rules/design.md` names outright for a page of this kind. The
 * `min-h-0` is what makes the fill real: a flex child defaults to its content's height, so without it
 * the inner scrollers grow instead of scrolling.
 */
export function ValidationDocumentsPage() {
  const usage = async (document: StoredDocument): Promise<DocumentUsage[]> => {
    const forms = await readBoundForms(document.id)

    return forms.map((form) => ({ id: form.id, label: form.name }))
  }

  const detach = async (document: StoredDocument, user: DocumentUsage) => {
    await detachFormFromDocument(document.id, user.id)
  }

  return (
    <ValidationTransportProvider value={validationTransport}>
      <PageHeader
        title="Validation documents"
        description="The rules a record is judged by. One document may judge many forms — that is how a quantity means the same thing everywhere."
      />

      {/* -mx-4 -mb-4 cancels the content box's own padding so the rail's divider reaches the true
          edges. ⚠️ **-mt-4 cancels something else: the wrapper is a flex column with `gap-4`**, and the
          header is the child before this one — so without it a 16px band of page background sits
          between the header's bottom border and the rail, which reads as the screen having come
          unstuck from its own header. Padding and gap are two different things to cancel, and getting
          three of the four looks like a mistake nobody made deliberately. */}
      <div className="-mx-4 -mt-4 -mb-4 flex min-h-0 flex-1 flex-col">
        <ValidationDocuments usage={usage} onDetach={detach} />
      </div>
    </ValidationTransportProvider>
  )
}
