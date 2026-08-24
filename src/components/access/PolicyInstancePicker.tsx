import { useState } from "react"
import { Button, Input } from "@jmouse/ui"
import { RecordSelect, type RecordOption } from "@/components/RecordSelect"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { usePolicyInstances } from "@/hooks/usePolicyWorkbench"
import type { PolicyInstanceKind } from "@/api/policy"

/**
 * The same answer without the control — an identifier resolved to the name beside it.
 *
 * For the rows that only *show* what a policy names. A table of `il40zlPgjrIGpofu` is a table nobody
 * can read, and resolving it in the row rather than only inside the editor is what makes the list worth
 * having: the whole point of listing subjects is recognising one.
 *
 * ⚠️ **Both halves, always.** The identifier is what the file carries and what a support conversation
 * quotes; the name is what a person recognises. Showing only the name would make two accounts with the
 * same display name indistinguishable in a screen about authorization.
 */
export function InstanceName({ kind, id }: { kind: PolicyInstanceKind; id: string }) {
  const { data } = usePolicyInstances(kind, id, 0, Boolean(id))
  const found = data?.options.find((option) => option.id === id)

  if (!id) {
    return <span className="text-xs text-muted-foreground italic">nobody chosen</span>
  }

  if (id === "*") {
    return <span className="font-mono text-xs">* — every one</span>
  }

  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm">{found?.name ?? id}</span>
      {found && <span className="truncate font-mono text-[11px] text-muted-foreground">{id}</span>}
    </span>
  )
}

/**
 * A workspace, an account or a person — found by typing, one page at a time.
 *
 * ⚠️ **Why this is not a `select`.** Scopes, permissions and roles are bounded by the build: four,
 * seventy and a handful, so a plain dropdown over all of them is honest. Workspaces and people are
 * bounded by **how big the customer is**. An installation with four thousand workspaces would send four
 * thousand rows to draw one control, and a `select` with four thousand options is not a control anybody
 * uses anyway — the value they want is found by typing part of its name.
 *
 * ⚠️ **The choosing itself is {@link RecordSelect}'s.** That is the same reasoning generalised: a
 * workspace, a holder, a place and a sourced choice are all *records*. What stays here is what is
 * specific — the catalogue this kind is searched in, and the two things a policy may name that no table
 * contains.
 *
 * ⚠️ **It writes an identifier and shows a name.** What goes into the policy is `id`, because that is
 * what the engine resolves. A picker showing only identifiers is one people use by pasting, and pasting
 * is how the wrong workspace gets a grant.
 */
export function InstancePicker({
  kind,
  value,
  disabled,
  allowEvery,
  placeholder,
  onChange,
}: {
  kind: PolicyInstanceKind
  value: string
  disabled?: boolean
  /** Offer `*` as the first option — legal for a place, meaningless for a subject. */
  allowEvery?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  const [isOpen, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const [page, setPage] = useState(0)

  // Debounced, because every keystroke is a query against the customer's tables rather than a filter
  // over a list already here.
  const query = useDebouncedValue(typed, 250)
  const { data, isFetching } = usePolicyInstances(kind, query, page, isOpen)

  const options: RecordOption[] = [
    ...(allowEvery ? [{ value: "*", label: "*", hint: "every one of them" }] : []),
    ...(data?.options ?? []).map((place) => ({
      value: place.id,
      label: place.name,
      hint: place.hint ?? place.id,
    })),
  ]

  return (
    <RecordSelect
      value={value}
      options={options}
      placeholder={placeholder ?? "choose…"}
      disabled={disabled}
      loading={isFetching}
      search={typed}
      onSearch={(next) => {
        setTyped(next)
        setPage(0)
      }}
      searchLabel={SEARCH_LABELS[kind]}
      empty={
        <>
          Nothing matches “{query}”. It can still be written by hand below — a policy may name a
          placeholder, or somebody who has not joined yet.
        </>
      }
      footer={
        <div className="flex flex-col gap-1.5">
          {/* ⚠️ Two rows, not three things in one. The escape hatch is a full-width field and was
              squeezing the two labels beside it until each wrapped onto two lines. */}
          <div className="flex items-center gap-2">
            {/* ⚠️ The count is stated rather than implied. A page of twenty that looks like the whole
                list is how somebody concludes a workspace does not exist. */}
            <span>{isFetching ? "searching…" : matchCount(data?.total ?? 0)}</span>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                title="Previous page"
                onClick={() => setPage(page - 1)}
              >
                ‹
              </Button>
              <span className="font-mono">{page + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!data?.hasMore}
                title="Next page"
                onClick={() => setPage(page + 1)}
              >
                ›
              </Button>
            </div>
          </div>

          {/* The escape hatch, and it has to be here: a `${placeholder}` resolved from configuration is
              a legal subject and no table will ever contain it. */}
          <Input
            className="h-8 font-mono text-xs"
            value={value === "*" ? "" : value}
            disabled={disabled}
            placeholder="…or write it out: an identifier, or ${a.placeholder}"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      }
      onOpenChange={(next) => {
        setOpen(next)

        if (!next) {
          setTyped("")
        }
      }}
      onChange={onChange}
      labelOf={(stored) => (stored === "*" ? "* — every one" : stored)}
    />
  )
}

/** `1 match` · `6 matches` — because "1 match(es)" is how a screen says nobody proof-read it. */
function matchCount(total: number): string {
  return `${total} ${total === 1 ? "match" : "matches"}`
}

/** What the window asks, in the words of whatever is being named. */
const SEARCH_LABELS: Record<PolicyInstanceKind, string> = {
  SPACE: "which workspace? a name, a slug or an identifier",
  ORGANIZATION: "which account? a name or an identifier",
  SUBJECT: "which account holds this? a name, an email or an identifier",
}
