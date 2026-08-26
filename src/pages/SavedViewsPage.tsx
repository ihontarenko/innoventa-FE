import { useMemo } from "react"
import { SavedQueryManager, type ManagedSubject } from "@jmouse/query"
import { PageHeader } from "@/components/PageHeader"
import { QUERY_LABELS } from "@/components/query/labels"
import { assetsOf, entriesOf } from "@/components/query/subjects"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"

/**
 * Saved views — every kept question in this workspace, beside the declaration each is written against.
 *
 * <h2>⚠️ The screen is the library's; only the list of subjects is Innoventa's</h2>
 *
 * <p>The store is one table shared by every product and the endpoints are the library's. What this file
 * supplies is the part that genuinely belongs here — and in Innoventa that part is not a constant, which
 * is the whole reason this page differs from Tessera's.</p>
 *
 * <h2>⚠️ ONE SUBJECT PER FORM, because an entry listing IS one form</h2>
 *
 * <p>What an entry query may name is the fields somebody built on a screen, so `entries` is not one
 * queryable thing — it is one per form, each with its own vocabulary, its own declaration and its own
 * kept views. Listing a single *Entries* row would show one form's views and silently hide the rest.</p>
 *
 * <p>Equipment is the exception and is listed once: an asset carries its own facts, so the useful answer
 * with no form chosen is those — which is why {@link assetsOf} takes an optional form and this passes
 * none.</p>
 *
 * <h2>⚠️ A view here belongs to the WORKSPACE, so this screen follows the active one</h2>
 *
 * <p>Switching workspace changes which forms exist, which means it changes the whole list rather than
 * filtering it. The forms hook is already keyed on the active workspace, so that happens by itself — but
 * it is the reason there is no workspace picker here: a saved view from another workspace would name
 * fields this one does not have.</p>
 */
export default function SavedViewsPage() {
  const { data: forms = [] } = useWorkspaceForms()

  const subjects = useMemo<ManagedSubject[]>(
    () => [
      {
        subject: assetsOf(),
        title: "Equipment",
        description:
          "What a query may ask about anything under watch — its state, when it came under watch, and " +
          "when it last changed.",
      },
      ...forms.map((form) => ({
        subject: entriesOf(form.id),
        title: form.name,
        description:
          form.description
          ?? `Entries recorded on this form — ${form.fieldCount} field${form.fieldCount === 1 ? "" : "s"}.`,
      })),
    ],
    [forms],
  )

  // ⚠️ A fragment, like every other page here. The shell's content box is already
  // `flex min-h-0 flex-1 flex-col gap-4 … p-4`, so a page that wraps itself in a padded column pays
  // for that padding twice — 40px of inset on a screen where every neighbour has 16px.
  return (
    <>
      <PageHeader
        title="Saved views"
        description="The questions kept against each listing, and the shape they are asked of."
      />

      <SavedQueryManager subjects={subjects} labels={QUERY_LABELS} />
    </>
  )
}
