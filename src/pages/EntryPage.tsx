import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { DynamicForm } from "@/components/form/DynamicForm"
import { EntryRecord } from "@/components/form/EntryRecord"
import { useForm } from "@/hooks/useForms"
import { useDeleteEntry, useEntry, useUpdateEntry } from "@/hooks/useWorkspaceForms"
import { LabelPrintButton } from "@/components/labels/LabelPrintButton"
import { readableMoment } from "@/lib/dates"

/**
 * One row, on a page of its own.
 *
 * ⚠️ **A page and not the drawer, because this address is *quoted*.** A parametric match, a search hit, a
 * link in a message — all of them name one row, and what they need is somewhere that survives being
 * pasted into a chat. The drawer is for working through a list without losing your place; this is for
 * arriving at one row from outside.
 *
 * ⚠️ **The read view is the same spec sheet the sharing page shows**, arranged by the form's own
 * `display.*` configuration. One arrangement, so a row read here and a row read by somebody following a
 * public link are recognisably the same record.
 */
export function EntryPage() {
  const { formId, entryId } = useParams<{ formId: string; entryId: string }>()
  const navigate = useNavigate()

  const { data: form, isLoading: formLoading } = useForm(formId)
  const { data: entry, isLoading: entryLoading } = useEntry(formId, entryId)

  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  const [editing, setEditing] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  if (formLoading || entryLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!form || !entry) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
        <span aria-hidden="true" className="text-2xl">
          ⌀
        </span>
        <span className="text-sm font-medium">No such record</span>
        <span className="max-w-md text-xs text-muted-foreground">
          It was deleted, or it belongs to a workspace you cannot reach. Those look the same from here on
          purpose — the second is not something this screen may confirm.
        </span>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={form.name}
        description={`Recorded ${readableMoment(entry.createdAt)}${
          entry.updatedAt !== entry.createdAt ? ` · changed ${readableMoment(entry.updatedAt)}` : ""
        }`}
        actions={
          editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={updateEntry.isPending}
                onClick={() => formRef.current?.requestSubmit()}
              >
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                Back
              </Button>

              {/* ⚠️ Draws itself only where all three are true — the module is on, this reader may
                  read records, and a design exists for THIS form. See `LabelPrintButton`. */}
              <LabelPrintButton
                formId={form.id}
                permission="entry:read"
                ids={[entry.id]}
                subject="This record"
                label="Print label"
              />

              {confirmingRemoval ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    deleteEntry.mutate(
                      { formId: form.id, entryId: entry.id },
                      {
                        onSuccess: () => {
                          toast.success("Deleted.")
                          navigate(-1)
                        },
                        onError: () => toast.error("That was not deleted."),
                      },
                    )
                  }
                >
                  Really delete
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmingRemoval(true)}
                >
                  Delete
                </Button>
              )}

              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )
        }
      />

      <div className="max-w-5xl">
        {editing ? (
          <DynamicForm
            form={form}
            initialValues={entry.fieldValues}
            isSubmitting={updateEntry.isPending}
            formRef={formRef}
            hideSubmitButton
            onSubmit={async (fieldValues) => {
              await updateEntry.mutateAsync({ formId: form.id, entryId: entry.id, fieldValues })
              toast.success("Saved.")
              setEditing(false)
            }}
          />
        ) : (
          <EntryRecord form={form} entry={entry} />
        )}
      </div>
    </>
  )
}
