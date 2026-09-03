import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge, DetailsPanel, cn, useDetailsPanel } from "@jmouse/ui"
import { DataTable } from "@/components/layout/DataTable"
import { ListScreen } from "@/components/layout/ListScreen"
import { HolderPanel } from "@/components/custody/HolderPanel"
import { EntryFormDialog } from "@/components/form/EntryFormDialog"
import { useHolderForms, useHolders } from "@/hooks/useCustody"
import { useCreateEntry } from "@/hooks/useWorkspaceForms"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { describeQueryFailure } from "@/lib/loadFailure"
import type { Holder } from "@/api/custody"

/**
 * Who can be carrying something here, and what each of them has.
 *
 * ⚠️ **These are entries, not accounts.** A person here is a submission on a form whose purpose is
 * `HOLDER` — an employee, a crew, a rental client — and none of them need ever have logged in. The
 * screen that lists people with accounts is `/admin/access`, and conflating the two would put a
 * workspace's members in the issue picker and the store's casual staff nowhere.
 *
 * ⚠️ **The word on screen is the workspace's**, through `term('holder.many')` — the electronics area
 * says *Personnel*. The model keeps its neutral noun because a crew and a rental client really are one
 * mechanism; what a person reads is the customer's word for it.
 *
 * ⚠️ **The same shell as Inventory**, through `ListScreen`. This screen used to arrange its own header,
 * put its type filters in the body as chips, and draw a card list — three departures from every other
 * list in the product, none of them wrong on its own. The rail carries the types of person, the chips
 * carry the two questions somebody actually arrives with, and the rows are a table like everywhere else.
 *
 * ⚠️ **The counts come from the server, in one query for everybody.** `CustodyPickers.holders` runs a
 * single grouped count of open possessions; the alternative is one request per row, and a screen that
 * asks forty questions to draw forty lines is wrong by the time it finishes.
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

  const [formName, setFormName] = useState<string | null>(null)
  const [carryingOnly, setCarryingOnly] = useState(false)
  const [lateOnly, setLateOnly] = useState(false)
  const [typed, setTyped] = useState("")
  /* ⚠️ **The same peek Inventory opens, not a modal sheet.** It was a `Sheet` that dimmed the list
     behind it while Inventory showed the same kind of thing as a third full-height column — the exact
     difference Ivan pointed an arrow at. `useDetailsPanel` decides column-or-overlay by width. */
  const peek = useDetailsPanel<Holder>()
  const [addingToFormId, setAddingToFormId] = useState<string | null>(null)
  const searchBox = useRef<HTMLInputElement>(null)

  const holders = useMemo(() => query.data ?? [], [query.data])

  /**
   * ⚠️ **Filtered in the browser, and that is not the mistake it is on the asset board.** This list is
   * not paged — the whole of it arrives in one answer — so narrowing it here narrows all of it, and a
   * count can never disagree with the rows under it.
   */
  const shown = useMemo(() => {
    const needle = typed.trim().toLowerCase()

    return holders
      .filter((holder) => (formName ? holder.formName === formName : true))
      .filter((holder) => (carryingOnly ? holder.holding > 0 : true))
      .filter((holder) => (lateOnly ? holder.overdue > 0 : true))
      .filter((holder) => (needle ? holder.label.toLowerCase().includes(needle) : true))
      .sort(byLatenessThenLoad)
  }, [holders, formName, carryingOnly, lateOnly, typed])

  const carrying = holders.filter((holder) => holder.holding > 0).length
  const late = holders.filter((holder) => holder.overdue > 0).length

  /**
   * ⚠️ **The rail lists the FORMS that describe people**, which is the same role types play on
   * Inventory. A workspace with staff and crews has two; one with neither has an empty rail and an
   * empty screen, which agree with each other.
   */
  const railItems = holderForms.map((form) => ({
    key: form.name,
    icon: "☺",
    label: form.name,
    count: holders.filter((holder) => holder.formName === form.name).length,
  }))

  return (
    <>
      <ListScreen
        title={capitalised(people)}
        description={describe(holders.length, carrying, late, person, people)}
        search={{
          value: typed,
          onChange: setTyped,
          placeholder: `Search ${people}… ( / )`,
          inputRef: searchBox,
        }}
        chips={[
          {
            label: "Carrying",
            active: carryingOnly,
            count: carrying,
            title: `Only ${people} who have something out right now`,
            onClick: () => setCarryingOnly((previous) => !previous),
          },
          {
            label: "Late",
            active: lateOnly,
            count: late,
            title: `Only ${people} holding something that was due back already`,
            onClick: () => setLateOnly((previous) => !previous),
          },
        ]}
        /* ⚠️ Adding a person is adding an ENTRY, on whichever form describes people here. Where a
           workspace has more than one such form — staff and crews — each gets its own button, because
           picking for somebody would file a subcontractor as an employee. */
        action={
          holderForms.length === 1
            ? { label: `Add ${person}`, onClick: () => setAddingToFormId(holderForms[0].id) }
            : undefined
        }
        extraActions={
          holderForms.length > 1
            ? holderForms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  className="border-border hover:bg-accent h-8 rounded-md border px-2.5 text-[13px]"
                  onClick={() => setAddingToFormId(form.id)}
                >
                  Add: {form.name}
                </button>
              ))
            : undefined
        }
        rail={
          holderForms.length > 0
            ? {
                title: "Kind",
                items: railItems,
                activeKey: formName,
                onSelect: setFormName,
                allLabel: `All ${people}`,
                allIcon: "☰",
                allCount: holders.length,
              }
            : undefined
        }
        failure={failure}
        onRetry={() => void query.refetch()}
        loading={query.isLoading}
        loadingRows={10}
        isEmpty={shown.length === 0}
        empty={{
          title: holders.length === 0 ? `No ${people} yet` : "Nobody here matches that",
          text:
            holders.length === 0
              ? holderForms.length > 0
                ? `Add somebody, and a ${thing} can be handed to them.`
                : `This workspace has no form describing ${people} — add one with the purpose HOLDER in the form library.`
              : "Widen the search, or clear the chips above.",
          actions:
            holders.length === 0 && holderForms.length > 0
              ? [
                  {
                    label: `Add ${person}`,
                    primary: true,
                    onClick: () => setAddingToFormId(holderForms[0].id),
                  },
                ]
              : [],
        }}
        /* ⚠️ **A peek, as the third column** — the same one Inventory opens, so the two screens behave
            alike rather than each teaching its own way of looking at a row. */
        detail={{
          open: Boolean(peek.subject) && !peek.narrow,
          node: peek.subject && (
            <DetailsPanel
              state={peek}
              title={peek.subject.label}
              description={
                peek.subject.formName +
                (peek.subject.overdue > 0 ? ` · ${peek.subject.overdue} overdue` : "")
              }
            >
              <HolderPanel holder={peek.subject} />
            </DetailsPanel>
          ),
        }}
      >
        <DataTable
          rows={shown}
          rowKey={(holder) => holder.entryId}
          onRowClick={(holder) => peek.show(holder)}
          columns={[
            {
              key: "label",
              header: capitalised(person),
              className: "max-w-72 truncate font-medium",
              cell: (holder) => holder.label,
            },
            {
              key: "form",
              header: "Kind",
              className: "text-muted-foreground",
              cell: (holder) => holder.formName,
            },
            {
              key: "holding",
              header: "Holding",
              align: "right",
              cell: (holder) =>
                holder.holding === 0 ? <span className="text-muted-foreground">—</span> : holder.holding,
            },
            {
              key: "overdue",
              header: "Overdue",
              align: "right",
              /* ⚠️ The one number this screen is read for. Whoever opens it is chasing something down,
                 so a late row is marked rather than merely counted. */
              cell: (holder) =>
                holder.overdue === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Badge variant="destructive" className={cn("font-normal")}>
                    {holder.overdue}
                  </Badge>
                ),
            },
          ]}
        />
      </ListScreen>


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

function describe(total: number, carrying: number, late: number, person: string, people: string) {
  if (total === 0) {
    return `Nobody yet`
  }

  const noun = total === 1 ? person : people
  const parts = [`${total} ${noun}`, `${carrying} carrying`]

  if (late > 0) {
    parts.push(`${late} late`)
  }

  return parts.join(" · ")
}
