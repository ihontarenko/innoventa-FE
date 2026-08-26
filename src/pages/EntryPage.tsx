import { useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { DynamicForm } from "@/components/form/DynamicForm"
import { EntryDossier } from "@/components/entry/EntryDossier"
import { ShareControl } from "@/components/sharing/ShareControl"
import { EntryLookupDialog } from "@/components/lookup/EntryLookupDialog"
import { useForm } from "@/hooks/useForms"
import { useDeleteEntry, useEntry, useUpdateEntry } from "@/hooks/useWorkspaceForms"
import { LabelPrintButton } from "@/components/labels/LabelPrintButton"
import { readableMoment } from "@/lib/dates"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { FormDetail } from "@/types"

/**
 * Where this record sits, as two links rather than as a title.
 *
 * ⚠️ **Back was blamed for this and Back was never the problem.** The list kept its chosen type, its
 * search and its page in component state, so returning to it landed on *All types* whatever somebody had
 * been looking at. That is fixed in `InventoryPage` by moving those into the address — and this exists
 * because a trail is the half that does not depend on history at all: somebody who arrived from a pasted
 * link, a search hit or a parametric match has nothing to go *back* to, and still needs a way up.
 *
 * ⚠️ **The second crumb carries the type**, so it lands on the list already narrowed rather than on
 * everything. It is the same `?type=` the list now reads.
 *
 * ⚠️ **Which list is decided by the record's PURPOSE, not by where the reader came from.** A catalogue
 * part reached from a search belongs under Catalogs however it was found; sending somebody "back" to a
 * screen their record does not live on is worse than sending them nowhere.
 */
function EntryTrail({ form, spaceSlug }: { form: FormDetail; spaceSlug: string | null }) {
  const section = form.purpose?.code === "INVENTORY" ? "inventory" : "catalog"
  const listPath = spaceSlug ? spaceSectionPath(spaceSlug, section) : null
  const listLabel = section === "inventory" ? "Inventory" : "Catalogs"

  if (!listPath) {
    return <span className="font-display text-lg font-semibold tracking-[-0.02em]">{form.name}</span>
  }

  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-1.5">
      <Link to={listPath} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        {listLabel}
      </Link>
      <span aria-hidden="true" className="text-muted-foreground/50">
        /
      </span>
      <Link
        to={`${listPath}?type=${encodeURIComponent(form.id)}`}
        className="truncate font-display text-lg font-semibold tracking-[-0.02em] hover:underline"
      >
        {form.name}
      </Link>
    </span>
  )
}

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
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const { data: form, isLoading: formLoading } = useForm(formId)
  const { data: entry, isLoading: entryLoading } = useEntry(formId, entryId)

  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()

  const [editing, setEditing] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const [isLookingUp, setLookingUp] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  /**
   * ⚠️ **Offered here for the same reason it is offered in the drawer, and by the same test.** Somebody
   * who arrived at this address from a search hit or a pasted link is looking at exactly the row a
   * lookup would fill; sending them back to a list to open the drawer over the same record was the only
   * thing that ever made this page the lesser of the two.
   */
  const canLookUp = form?.purpose?.code === "INVENTORY" || form?.purpose?.code === "CATALOG"

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
        title={<EntryTrail form={form} spaceSlug={spaceSlug} />}
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

              {/* ⚠️ Offered on a part, whatever its type maps — see `canLookUp`. */}
              {canLookUp && (
                <Button variant="outline" size="sm" onClick={() => setLookingUp(true)}>
                  <Search className="size-3.5" />
                  Look up
                </Button>
              )}

              {/* ⚠️ The record's own public address, minted from the record. Until this existed a row
                  could be *shown* as shared — `EntryIdentityCard` draws the badge — and never made so,
                  which is why the Sharing Centre counted zero shared entries. */}
              <ShareControl entityType="ENTRY" entityId={entry.id} subject="this record" />

              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )
        }
      />

      {/* ⚠️ **Wide while reading, narrow while editing, and the difference is not cosmetic.** A record
          is read across — specifications beside stock beside what it is attached to — and the old
          `max-w-5xl` left two thirds of a desktop window empty. A form is filled in down a single
          column, and a row of inputs stretched across 2000px is a row nobody can follow from label to
          control. */}
      <div className={editing ? "max-w-3xl" : "min-w-0"}>
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
          <EntryDossier form={form} entry={entry} onLookUp={canLookUp ? () => setLookingUp(true) : undefined} />
        )}
      </div>

      {/* ⚠️ Applying writes through the same update call an edit does — one write path, so a value taken
          from a distributor is validated exactly as a typed one is. */}
      {isLookingUp && (
        <EntryLookupDialog
          entry={entry}
          form={form}
          isSaving={updateEntry.isPending}
          onApply={async (fieldValues) => {
            await updateEntry.mutateAsync({ formId: form.id, entryId: entry.id, fieldValues })
            setLookingUp(false)
          }}
          onClose={() => setLookingUp(false)}
        />
      )}
    </>
  )
}
