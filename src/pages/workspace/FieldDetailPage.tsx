import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Badge, Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { TagEditor } from "@/components/TagEditor"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { ChildPickerDialog } from "@/components/form/builder/ChildPickerDialog"
import { FieldEditor } from "@/components/form/builder/FieldEditor"
import { USAGE_TYPES, fieldTypeOf } from "@/lib/fieldTypes"
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
  const usage = USAGE_TYPES.find((candidate) => candidate.value === field.usageType)

  return (
    <>
      <PageHeader
        title={`${field.icon || descriptor.glyph} ${field.label}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{field.name}</span>
            <Badge variant="secondary">{descriptor.label}</Badge>
            {usage && <Badge variant="outline">{usage.label}</Badge>}
            {field.unit && <Badge variant="secondary">{field.unit}</Badge>}
          </span>
        }
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

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="overflow-hidden rounded-lg border">
          <FieldEditor fieldId={field.id} variant="page" onPickChild={() => setPickingChild(true)} />
        </div>

        {/* ⚠️ A card of its own, as the old interface had it — and NOT inside the editor's footer. A tag
            writes immediately and the editor's Save covers a draft; putting the two under one button was
            the thing that made the old screen's Save ambiguous. */}
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">Tags</span>
          <TagEditor entityId={field.id} entityKind="FIELD" />
        </div>
      </div>

      <ChildPickerDialog fieldId={field.id} open={isPickingChild} onClose={() => setPickingChild(false)} />
    </>
  )
}
