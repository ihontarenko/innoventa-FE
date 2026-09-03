import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { ChildPickerDialog } from "@/components/form/builder/ChildPickerDialog"
import { FieldEditor } from "@/components/form/builder/FieldEditor"
import { fieldTypeOf } from "@/lib/fieldTypes"
import { describeQueryFailure } from "@/lib/loadFailure"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useDeleteField } from "@/hooks/useFieldCatalogue"
import { useField } from "@/hooks/useForms"

/**
 * One field at an address of its own — the screen the old interface had, and the reason a link to a
 * field is worth anything.
 *
 * ⚠️ **Not a second editor.** It is the same `FieldEditor` the row expands into, in its `page` variant:
 * the difference is that the page scrolls rather than the card, and that this one can be opened in a
 * tab, bookmarked, and sent to somebody. A page with its own controls would be a second place every
 * rule about drafts and saving has to be right.
 *
 * ⚠️ **It is also the mobile destination.** Below `lg` a catalogue row does not expand — it comes here,
 * where one column of cards has the whole width of a phone rather than a third of a builder.
 *
 * ⚠️ **A condition is absent here, and that is not an omission** — a condition belongs to a form, and a
 * field addressed on its own is not on one. The builder is where that question can be asked.
 */
export function FieldDetailPage() {
  const { spaceSlug, fieldId } = useParams()
  const navigate = useNavigate()
  const query = useField(fieldId)
  const failure = describeQueryFailure(query, "field")
  const deleteField = useDeleteField()

  const [isPickingChild, setPickingChild] = useState(false)
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const fieldsPath = spaceSectionPath(spaceSlug ?? "", "fields")

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  if (!query.data) {
    return (
      <>
        <PageHeader title="Field" description={spaceSlug} />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-72 w-full" />
        </div>
      </>
    )
  }

  const field = query.data
  const descriptor = fieldTypeOf(field.elementType)

  return (
    <>
      {/*
        ⚠️ **The header says where you are, and stops there — the editor says what this field IS.**
        It used to repeat the codename, the type and the usage on a second line, an inch above the
        editor's own identity strip which shows all three again *and lets you change them*: the same
        four facts twice, the higher copy the one you cannot edit. A page header names the page; the
        name is the one thing it may share with the content, because that is what a header is.

        The type and the usage have a home already — *Shape*, the first card, where they are chosen.
      */}
      <PageHeader
        title={`${field.icon || descriptor.glyph} ${field.label}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to={fieldsPath}>
                <ArrowLeft className="size-3.5" />
                Fields
              </Link>
            </Button>

            {isConfirmingDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  deleteField.mutate(field.id, {
                    onSuccess: () => {
                      toast.success(`${field.label} deleted.`)
                      navigate(fieldsPath)
                    },
                    // ⚠️ The backend's own sentence. "Could not delete" hides the one useful fact —
                    // that a form still carries it — and sends somebody looking at permissions.
                    onError: (error) => {
                      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

                      toast.error(detail ?? "Could not delete this field.")
                      setConfirmingDelete(false)
                    },
                  })
                }
              >
                Really delete
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />

      {/*
        ⚠️ **No box around the editor, and no width it has to sit inside.** This screen used to draw a
        `max-w-5xl` bordered card and centre it, which on a wide monitor is a form standing in the middle
        of an empty page — and the editor's own cards were then a box inside a box inside a page. The
        editor already paints its own tiles; the page's job is to give them the width, which is also what
        lets the two-column grid stop being two narrow columns beside a wide margin.

        ⚠️ **The Tags card is gone because it was the SECOND one.** `AdvancedSection` has carried a
        `TagEditor` for this field since the editor was built, so the page drew the same control twice —
        which is most of why it read as assembled rather than designed. The note that used to be here
        argued tags must not sit under the editor's Save; they do not, and never did: the card in
        *Advanced* says in as many words that it writes immediately and that Save does not cover it.
      */}
      <div className="flex w-full flex-col gap-3">
        <FieldEditor fieldId={field.id} variant="page" onPickChild={() => setPickingChild(true)} />
      </div>

      <ChildPickerDialog fieldId={field.id} open={isPickingChild} onClose={() => setPickingChild(false)} />
    </>
  )
}
