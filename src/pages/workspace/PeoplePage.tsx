import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  cn,
  Input,
  Row,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { HolderDrawer } from "@/components/custody/HolderDrawer"
import { EntryFormDialog } from "@/components/form/EntryFormDialog"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { useHolderForms, useHolders } from "@/hooks/useCustody"
import { useCreateEntry } from "@/hooks/useWorkspaceForms"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { describeQueryFailure } from "@/lib/loadFailure"
import type { Holder } from "@/api/custody"

/**
 * Who can be carrying something here, and what each of them has.
 *
 * ⚠️ **These are entries, not accounts.** A holder is a submission on a form whose purpose is
 * `HOLDER` — an employee, a crew, a rental client — and none of them need ever have logged in. The
 * screen that lists people with accounts is `/admin/access`, and conflating the two would put a
 * workspace's members in the issue picker and the store's casual staff nowhere.
 *
 * ⚠️ **The counts come from the server, in one query for everybody.** `CustodyPickers.holders` runs a
 * single grouped count of open possessions; the alternative is one request per row, and a screen that
 * asks forty questions to draw forty lines is a screen that is wrong by the time it finishes.
 *
 * ⚠️ **The word on screen is "People", and the model's word is "holder".** A crew and a rental client
 * are the same mechanism as a person, but nobody staffing a store thinks in it — so the model keeps
 * its noun and the interface says the ordinary one. Step 23 of the roadmap replaces this English
 * literal with a term the workspace chooses.
 */
export function PeoplePage() {
  const query = useHolders()
  const failure = describeQueryFailure(query, "people")

  const { data: holderForms = [] } = useHolderForms()
  const createEntry = useCreateEntry()

  const term = useTerm()
  const person = term("holder.one", "person")
  const people = term("holder.many", "people")
  const thing = term("thing.one", "thing")

  const [formId, setFormId] = useState<string | undefined>(undefined)
  const [carryingOnly, setCarryingOnly] = useState(false)
  const [lateOnly, setLateOnly] = useState(false)
  const [typed, setTyped] = useState("")
  const [openHolder, setOpenHolder] = useState<Holder | null>(null)
  const [addingToFormId, setAddingToFormId] = useState<string | null>(null)

  const holders = useMemo(() => query.data ?? [], [query.data])

  /**
   * ⚠️ **Filtered in the browser, and that is not the mistake it is on the asset board.** This list is
   * not paged — the whole of it arrives in one answer — so narrowing it here narrows all of it, and a
   * count can never disagree with the rows under it.
   */
  const shown = useMemo(() => {
    const needle = typed.trim().toLowerCase()

    return holders
      .filter((holder) => (formId ? holder.formName === formNameOf(holderForms, formId) : true))
      .filter((holder) => (carryingOnly ? holder.holding > 0 : true))
      .filter((holder) => (lateOnly ? holder.overdue > 0 : true))
      .filter((holder) => (needle ? holder.label.toLowerCase().includes(needle) : true))
      .sort(byLatenessThenLoad)
  }, [holders, holderForms, formId, carryingOnly, lateOnly, typed])

  const carrying = holders.filter((holder) => holder.holding > 0).length
  const late = holders.filter((holder) => holder.overdue > 0).length

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  return (
    <>
      <PageHeader
        title={capitalised(people)}
        description={describe(holders.length, carrying, late, person, people)}
        actions={
          <>
            <ToggleChip
              active={carryingOnly}
              title="Only people who have something out right now"
              onClick={() => setCarryingOnly((previous) => !previous)}
            >
              Carrying
            </ToggleChip>

            <ToggleChip
              active={lateOnly}
              title="Only people holding something that was due back already"
              onClick={() => setLateOnly((previous) => !previous)}
            >
              Late
            </ToggleChip>

            <Input
              className="h-8 w-56 text-sm"
              value={typed}
              placeholder={`Find a ${person}…`}
              onChange={(event) => setTyped(event.target.value)}
            />

            {/* ⚠️ Adding a person is adding an ENTRY, on whichever form describes people here. Where a
                workspace has more than one such form — staff and crews, say — the button offers each,
                because picking for somebody would file a subcontractor as an employee. */}
            {holderForms.map((form) => (
              <Button key={form.id} size="sm" onClick={() => setAddingToFormId(form.id)}>
                {holderForms.length === 1 ? `Add a ${person}` : `Add: ${form.name}`}
              </Button>
            ))}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* ⚠️ Chips rather than a filter column: `FilterPanel` is for a catalogue — many choices, named
            by the customer, carrying counts — and a workspace has one or two forms describing people.
            Three hundred pixels of chrome for one line of meaning is the case its own header warns off. */}
        {holderForms.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <ToggleChip active={!formId} onClick={() => setFormId(undefined)}>
              Everyone
            </ToggleChip>
            {holderForms.map((form) => (
              <ToggleChip
                key={form.id}
                active={formId === form.id}
                onClick={() => setFormId(formId === form.id ? undefined : form.id)}
              >
                {form.name}
              </ToggleChip>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-3">
          {query.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : holders.length === 0 ? (
            <NobodyYet
              thing={thing}
              people={people}
              hasHolderForm={holderForms.length > 0}
              onAdd={() => setAddingToFormId(holderForms[0]?.id ?? null)}
            />
          ) : shown.length === 0 ? (
            <div className="rounded-md border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Nobody here matches that.
            </div>
          ) : (
            <RowList>
              {shown.map((holder) => (
                <PersonRow key={holder.entryId} holder={holder} onOpen={() => setOpenHolder(holder)} />
              ))}
            </RowList>
          )}
        </div>
      </div>

      {openHolder && <HolderDrawer holder={openHolder} onClose={() => setOpenHolder(null)} />}

      {addingToFormId && (
        <EntryFormDialog
          formId={addingToFormId}
          formName={holderForms.find((form) => form.id === addingToFormId)?.name}
          submitLabel="Add them"
          isSubmitting={createEntry.isPending}
          onSubmit={async (values) => {
            await createEntry.mutateAsync({ formId: addingToFormId, fieldValues: values })
            toast.success("Added.")
            setAddingToFormId(null)
            await query.refetch()
          }}
          onClose={() => setAddingToFormId(null)}
        />
      )}
    </>
  )
}

/**
 * ⚠️ **Late first, then by how much somebody is carrying.** The screen is read by whoever is chasing
 * things down, and alphabetical order buries the one row that needed them.
 */
function byLatenessThenLoad(one: Holder, other: Holder) {
  if (one.overdue !== other.overdue) {
    return other.overdue - one.overdue
  }

  if (one.holding !== other.holding) {
    return other.holding - one.holding
  }

  return one.label.localeCompare(other.label)
}

function formNameOf(forms: Array<{ id: string; name: string }>, formId: string) {
  return forms.find((form) => form.id === formId)?.name
}

function describe(total: number, carrying: number, late: number, person: string, people: string) {
  if (total === 0) {
    return `No ${people} who can be handed anything — yet`
  }

  const load = carrying === 0 ? "nobody is carrying anything" : `${carrying} carrying something`
  const counted = `${total} ${total === 1 ? person : people}`

  return late > 0 ? `${counted} — ${load}, ${late} late` : `${counted} — ${load}`
}

/**
 * ⚠️ **Two different empties, and only one of them is the user's to fix.** A workspace with no holder
 * form has nowhere to put a person, and telling somebody to "add one" would lead to a button that
 * cannot exist. A workspace that has the form and nobody on it is one click from working.
 */
function NobodyYet({
  thing,
  people,
  hasHolderForm,
  onAdd,
}: {
  thing: string
  people: string
  hasHolderForm: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        ☺
      </span>
      <span className="text-sm font-medium">No {people} yet</span>

      {hasHolderForm ? (
        <>
          <span className="max-w-md text-xs text-muted-foreground">
            A {thing} cannot be handed over until there is somebody to hand it to. These are entries in
            this workspace, not accounts — an employee, a crew, a rental client. Nobody needs to sign in
            to carry a drill.
          </span>
          <Button size="sm" className="mt-2" onClick={onAdd}>
            Add the first one
          </Button>
        </>
      ) : (
        <span className="max-w-md text-xs text-muted-foreground">
          This workspace has no form describing {people}. One is created with the purpose{" "}
          <code className="font-mono text-[0.7rem]">HOLDER</code> in the form library, and everybody on
          it appears here.
        </span>
      )}
    </div>
  )
}

function PersonRow({ holder, onOpen }: { holder: Holder; onOpen: () => void }) {
  const carrying = holder.holding > 0

  return (
    <Row
      onOpen={onOpen}
      // ⚠️ Late paints the row, the same way it does on the asset board — one visual language for one
      // fact, so somebody scanning either screen is scanning for the same thing.
      className={cn(holder.overdue > 0 && "border-l-2 border-l-destructive bg-destructive/5")}
      leading={<span aria-hidden="true">{carrying ? "→" : "☺"}</span>}
      trailing={
        <>
          {holder.overdue > 0 && <Badge variant="destructive">{holder.overdue} late</Badge>}
          {carrying && <Badge variant="outline">{holder.holding} out</Badge>}
          <Badge variant="secondary">{holder.formName}</Badge>
        </>
      }
    >
      <RowTitle>{holder.label}</RowTitle>
      <RowMeta>{carrying ? `Carrying ${holder.holding}` : "Carrying nothing"}</RowMeta>
    </Row>
  )
}
