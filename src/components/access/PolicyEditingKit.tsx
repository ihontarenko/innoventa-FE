import { useState, type ReactNode } from "react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@jmouse/ui"
import { SegmentedControl } from "@/components/SegmentedControl"
import type { PolicyVocabularyView } from "@/api/policy"
import { InstancePicker } from "./PolicyInstancePicker"

/**
 * The shell and the controls every block of the policy form is built from.
 *
 * ⚠️ **A list to scan, and a form to open — never both at once.** Each block is a table of one line
 * each, and opening a line is a dialog holding the editor. The alternative — a column of fully expanded
 * cards — meant ten roles were ten open editors with a row per permission, and finding one meant
 * scrolling past four hundred controls that were not it. Two jobs had been folded into one surface:
 * *which of these is the one I want*, which wants a table, and *what exactly does it say*, which wants
 * a form.
 *
 * ⚠️ **And the draft is local until Apply.** Every change to the document goes to the server to be
 * written back out as `.jmp` — that is the whole point of there being one renderer of the grammar.
 * Editing in place would therefore be a request per keystroke. {@link PolicyEditorDialog} holds a draft
 * and hands the document back once, on Apply, so a dialog is one round trip and Cancel is genuinely
 * nothing having happened.
 *
 * ⚠️ **Every `<select>` here is the browser's own.** The application's Radix select is the right control
 * for six options with icons; these carry seventy permissions with a sentence each, inside a table cell
 * that has to stay one line tall. A native listbox is the one that types-to-find, scrolls with the
 * keyboard, and never reflows the row it sits in.
 */

// ── Choosing a line to edit ──────────────────────────────────────────────────

/**
 * Which line of a block is open, and what it started as.
 *
 * `index` is null for one that does not exist yet. A new line is deliberately **not** appended to the
 * document when the button is pressed: appending first makes Cancel a thing that leaves an empty role
 * behind, and an empty role is a parse error nobody wrote.
 */
export interface SectionEditing<Line> {
  index: number | null
  initial: Line
}

export function useSectionEditing<Line>() {
  const [editing, setEditing] = useState<SectionEditing<Line> | null>(null)

  return {
    editing,
    open: (index: number | null, initial: Line) => setEditing({ index, initial }),
    close: () => setEditing(null),
  }
}

/** The list with one line replaced, or with one appended where the line is new. */
export function applyToList<Line>(list: Line[], index: number | null, next: Line): Line[] {
  return index === null ? [...list, next] : list.map((candidate, at) => (at === index ? next : candidate))
}

export function removeFromList<Line>(list: Line[], index: number): Line[] {
  return list.filter((_, at) => at !== index)
}

// ── The block ────────────────────────────────────────────────────────────────

/**
 * One block of the document: a heading, a way to add a line, and the lines.
 *
 * Written once because all five blocks are the same shape — and because five copies of a table header
 * is how the fifth one comes to be spelled differently from the other four.
 */
export function PolicySection({
  label,
  note,
  addLabel,
  readOnly,
  onAdd,
  columns,
  empty,
  count,
  children,
}: {
  label: string
  /** What this block is for, in one sentence — read once, by whoever arrives here first. */
  note?: ReactNode
  addLabel: string
  readOnly: boolean
  onAdd: () => void
  columns: string[]
  /** Shown in place of the table where the block declares nothing. */
  empty: { glyph: string; title: string; message: string }
  count: number
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">{label}</h3>
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
        {!readOnly && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </div>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {count === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
          <span aria-hidden="true" className="text-2xl">
            {empty.glyph}
          </span>
          <span className="text-sm font-medium">{empty.title}</span>
          <span className="max-w-md text-xs text-muted-foreground">{empty.message}</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>{children}</TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

/** The last cell of every policy row: the one way in. */
export function OpenCell({ onOpen, readOnly }: { onOpen: () => void; readOnly: boolean }) {
  return (
    <TableCell className="text-right">
      <Button variant="ghost" size="sm" onClick={onOpen}>
        {readOnly ? "View" : "Edit"}
      </Button>
    </TableCell>
  )
}

/** What a row says when the policy says nothing there. */
export function RowMuted({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}

/** A row of badges — roles, scopes, the first few lines of a tier. */
export function ChipRow({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1" title={title}>
      {children}
    </span>
  )
}

/** The badge this cluster writes identifiers in, since `@jmouse/ui` has no mono variant. */
export function MonoBadge({
  children,
  variant = "secondary",
  className,
}: {
  children: ReactNode
  variant?: "default" | "secondary" | "outline" | "destructive"
  className?: string
}) {
  return (
    <Badge variant={variant} className={cn("font-mono text-[11px]", className)}>
      {children}
    </Badge>
  )
}

// ── The lines inside one editor ──────────────────────────────────────────────

/**
 * A named group of lines inside an editor: a heading with its count, thin rows, and one way to add.
 *
 * Written once because every editor in this cluster holds one or two of these, and two copies of a
 * table header is how the second one comes to be spelled differently from the first.
 *
 * ⚠️ The empty state is a **line** rather than a pane. An editor holding two groups, one of them empty,
 * would otherwise give three hundred pixels to the half that has nothing to say and push the half that
 * does off the screen.
 */
export function LineTable({
  heading,
  columns,
  count,
  quiet,
  addLabel,
  onAdd,
  children,
}: {
  heading: string
  columns: string[]
  count: number
  /** One sentence in place of the table where the group is empty. */
  quiet: string
  /** Absent where the reader may not write. */
  addLabel?: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">{heading}</span>
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
        {addLabel && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </div>

      {count === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{quiet}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {columns.map((column) => (
                  <th key={column} className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                    {column}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/**
 * One line of a group.
 *
 * ⚠️ **`denial` marks the whole row, and it is deliberately not subtle.** A deny wins over every allow
 * anywhere, so it is the one line in a table nobody may skim past — a tint alone disappears in half the
 * 29 palettes, which is why the left edge carries it too.
 */
export function Line({ children, denial = false }: { children: ReactNode; denial?: boolean }) {
  return (
    <tr className={cn("border-b last:border-0", denial && "bg-destructive/10 border-l-2 border-l-destructive")}>
      {children}
    </tr>
  )
}

/** A cell of a line — narrow padding, because a grant carries four controls and still has to fit. */
export function LineCell({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-2 py-1.5 align-middle", className)}>{children}</td>
}

/** The last cell of a line: the one way out of it. */
export function RemoveCell({ readOnly, onRemove }: { readOnly: boolean; onRemove: () => void }) {
  return (
    <td className="px-1 py-1.5 text-right align-middle">
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove this line"
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          ✕
        </button>
      )}
    </td>
  )
}

// ── The editor ───────────────────────────────────────────────────────────────

/**
 * One line of the policy, opened.
 *
 * ⚠️ **Remove sits on the far side of the footer from Apply.** They are the two irreversible-ish things
 * this dialog can do and they must not be adjacent: a policy edit is authorization, and the gap between
 * "save what I wrote" and "delete this role" is the only thing standing between a tired administrator
 * and a bundle nobody meant to lose. It also asks twice, for the same reason.
 */
export function PolicyEditorDialog<Line>({
  title,
  description,
  initial,
  readOnly,
  width = "sm:max-w-3xl",
  onRemove,
  onApply,
  onClose,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  initial: Line
  readOnly: boolean
  /**
   * A Tailwind max-width — a bundle of seventy permissions and a four-field form want different rooms.
   *
   * ⚠️ **It has to carry the `sm:` prefix.** `DialogContent` pins `sm:max-w-lg`, and an unprefixed
   * `max-w-4xl` does not conflict with a *responsive* class, so tailwind-merge keeps both and the
   * breakpoint one wins above 640px. The symptom is silent: every editor renders at `lg` no matter what
   * it asked for, and a permission table comes out four wrapped words wide.
   */
  width?: string
  /** Absent for a line that does not exist yet — there is nothing to remove. */
  onRemove?: () => void
  onApply: (next: Line) => void
  onClose: () => void
  children: (draft: Line, setDraft: (next: Line) => void) => ReactNode
}) {
  const [draft, setDraft] = useState<Line>(initial)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(width, "flex max-h-[85vh] flex-col gap-3")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Nothing here is in force until the document is rehearsed and saved."}
          </DialogDescription>
        </DialogHeader>

        {/* ⚠️ The body scrolls, the footer does not. A bundle is seventy rows tall, and an Apply that
            has scrolled off the screen is an Apply people stop finding. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">{children(draft, setDraft)}</div>

        <DialogFooter className="sm:justify-start">
          {onRemove &&
            !readOnly &&
            (confirmingRemoval ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onRemove()
                  onClose()
                }}
              >
                Really remove
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmingRemoval(true)}>
                Remove
              </Button>
            ))}

          <div className="flex-1" />

          <Button variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              onClick={() => {
                onApply(draft)
                onClose()
              }}
            >
              Apply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A labelled control inside an editor, with the sentence that says why it is there. */
export function EditorField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Two columns where there is room for two, one where there is not. */
export function EditorGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

// ── Controls shared by more than one block ───────────────────────────────────

/**
 * The browser's own listbox, painted like everything else.
 *
 * ⚠️ Written once here rather than per call site: seven blocks reach for it, and seven copies of a
 * class list is how the seventh comes out a different height from the other six.
 */
export function PlainSelect({
  value,
  disabled,
  title,
  className,
  onChange,
  children,
}: {
  value: string
  disabled?: boolean
  title?: string
  className?: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-8 w-full min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </select>
  )
}

/**
 * A scope and — only where the scope is a place — which one.
 *
 * ⚠️ The instance picker appears **exactly when the kind carries one**. Offered on `@SELF` it would
 * write `@SELF:x`, which means nothing; missing on `@SPACE` it would write a grant in every workspace at
 * once, which is the escalation this language was designed to make unwritable.
 */
export function ScopePicker({
  scope,
  instance,
  vocabulary,
  disabled,
  onChange,
}: {
  scope: string
  instance: string | null
  vocabulary?: PolicyVocabularyView
  disabled: boolean
  onChange: (scope: string, instance: string | null) => void
}) {
  const kind = vocabulary?.scopes.find((candidate) => candidate.name === scope)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <PlainSelect
        value={scope}
        disabled={disabled}
        className="w-auto min-w-28"
        onChange={(next) => {
          const chosen = vocabulary?.scopes.find((candidate) => candidate.name === next)

          onChange(next, chosen?.namesAnInstance ? (instance ?? "*") : null)
        }}
      >
        {(vocabulary?.scopes ?? []).map((option) => (
          <option key={option.name} value={option.name}>
            @{option.name}
          </option>
        ))}
      </PlainSelect>

      {kind?.namesAnInstance && (
        <div className="min-w-40 flex-1">
          <InstancePicker
            kind={scope === "ORGANIZATION" ? "ORGANIZATION" : "SPACE"}
            value={instance ?? "*"}
            disabled={disabled}
            allowEvery
            placeholder="which one?"
            onChange={(next) => onChange(scope, next)}
          />
        </div>
      )}
    </div>
  )
}

/** Every permission the installation registers, described in the words the policy gives it. */
export function PermissionSelect({
  value,
  vocabulary,
  disabled,
  onChange,
}: {
  value: string
  vocabulary?: PolicyVocabularyView
  disabled: boolean
  onChange: (permission: string) => void
}) {
  const namespaces = new Set((vocabulary?.permissions ?? []).map((permission) => permission.name.split(":")[0]))

  return (
    <PlainSelect
      value={value}
      disabled={disabled}
      className="min-w-48 font-mono text-xs"
      title={vocabulary?.permissions.find((permission) => permission.name === value)?.description ?? ""}
      onChange={onChange}
    >
      {/* A wildcard is expanded at load, so what somebody holds stays listable. */}
      {[...namespaces].sort().map((namespace) => (
        <option key={`${namespace}:*`} value={`${namespace}:*`}>
          {namespace}:* — the whole namespace
        </option>
      ))}
      {(vocabulary?.permissions ?? []).map((permission) => (
        <option key={permission.name} value={permission.name}>
          {permission.name}
          {permission.description ? ` — ${permission.description}` : ""}
        </option>
      ))}
    </PlainSelect>
  )
}

/** One line of a bundle: a permission, and how far the role carries it. */
export type BundleLine = { permission: string; scope: string }

/**
 * A whole bundle at once — every permission the installation registers, grouped by namespace.
 *
 * ⚠️ **Why this replaced a column of dropdowns.** A `<select>` shows one option at a time. Editing
 * `GLOBAL_ADMIN` meant opening a dropdown fifty times and never once seeing the shape of what the role
 * carried — which is the question somebody opens this screen to answer. A table of thin rows answers
 * *what does this role carry* by being looked at.
 *
 * ⚠️ **Carried or not is a two-state segmented, not a checkbox.** The same gesture the per-account
 * grants use, so the two screens that decide what somebody may do are operated the same way. A checkbox
 * beside a permission also reads as *effective*, which it is not: this says only what the **role**
 * carries, and what a person ends up with is that minus every deny anywhere.
 *
 * ⚠️ **Offered, never authored.** The vocabulary is compile-time fact — so there is no add, no rename
 * and no delete here. What this edits is which of them a role carries, and how far.
 *
 * ⚠️ **A permission and its reach are two decisions.** The scope stays its own control on the carried
 * line rather than collapsing into the toggle: `SPACE_MEMBER` carries `form:write` at `@SELF` and
 * `tag:write` at `@SPACE` — one tick with an implied scope could not say that, and it is the distinction
 * the whole permission axis turns on.
 *
 * ⚠️ **Flat, because a bundle is flat.** The grouping is by name prefix and nothing more. There are no
 * nested roles in this grammar, and a tree would imply an inheritance the language refuses to express.
 */
export function PermissionChecklist({
  bundle,
  vocabulary,
  disabled,
  onChange,
}: {
  bundle: BundleLine[]
  vocabulary?: PolicyVocabularyView
  disabled: boolean
  onChange: (bundle: BundleLine[]) => void
}) {
  const [filter, setFilter] = useState("")
  const [showing, setShowing] = useState<"all" | "carried">("all")

  const scopes = vocabulary?.scopes ?? []
  const defaultScope = scopes[0]?.name ?? ""
  const carried = new Map(bundle.map((entry) => [entry.permission, entry.scope]))

  const needle = filter.trim().toLowerCase()
  const matching = (vocabulary?.permissions ?? []).filter((permission) => {
    const named =
      needle === "" ||
      permission.name.toLowerCase().includes(needle) ||
      (permission.description ?? "").toLowerCase().includes(needle)

    return named && (showing === "all" || carried.has(permission.name))
  })

  const namespaces = [...new Set(matching.map((permission) => permission.name.split(":")[0]))].sort()

  function carry(permission: string, carriedNow: boolean) {
    onChange(
      carriedNow
        ? [...bundle, { permission, scope: defaultScope }]
        : bundle.filter((entry) => entry.permission !== permission),
    )
  }

  function carryAt(permission: string, scope: string) {
    onChange(bundle.map((entry) => (entry.permission === permission ? { ...entry, scope } : entry)))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sticky, because the count is what tells you whether the filter hid something. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-background pb-2">
        <Input
          className="h-8 w-64 text-sm"
          value={filter}
          placeholder="filter — a name or a word from its description"
          onChange={(event) => setFilter(event.target.value)}
        />

        {/* ⚠️ The one control that turns "the catalogue" into "this role". Reading a bundle of six out
            of seventy meant scrolling past sixty-four rows that were not it. */}
        <SegmentedControl
          ariaLabel="Which permissions to list"
          value={showing}
          onChange={setShowing}
          segments={[
            { value: "all", label: "All" },
            { value: "carried", label: "Carried" },
          ]}
        />

        <Badge variant="secondary" className="font-mono">
          {bundle.length} of {vocabulary?.permissions.length ?? 0}
        </Badge>
      </div>

      {namespaces.map((namespace) => {
        const inNamespace = matching.filter((permission) => permission.name.startsWith(`${namespace}:`))
        const held = inNamespace.filter((permission) => carried.has(permission.name)).length

        return (
          <section key={namespace} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-[0.04em] uppercase">{namespace}</span>
              <Badge variant="secondary" className="font-mono">
                {held}/{inNamespace.length}
              </Badge>
            </div>

            {/* ⚠️ overflow-x-auto, not overflow-hidden: the fixed widths below (w-56 + w-36 + w-28)
                total 480px before the description column, so in anything narrower than sm:max-w-4xl
                the Carry control was clipped away with no way to scroll to it. */}
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[40rem] text-sm">
                <tbody>
                  {inNamespace.map((permission) => {
                    const scope = carried.get(permission.name)

                    return (
                      <tr
                        key={permission.name}
                        className={cn("border-b last:border-0", scope !== undefined && "bg-primary/5")}
                      >
                        <LineCell className="w-56 font-mono text-xs">{permission.name}</LineCell>
                        <LineCell className="text-xs text-muted-foreground">{permission.description ?? ""}</LineCell>
                        <LineCell className="w-36">
                          {/* The reach appears only once the line is carried — an empty scope control
                              beside a permission the role does not have asks a question about
                              something that is not there. */}
                          {scope !== undefined && (
                            <PlainSelect
                              value={scope}
                              disabled={disabled}
                              onChange={(next) => carryAt(permission.name, next)}
                            >
                              {scopes.map((each) => (
                                <option key={each.name} value={each.name}>
                                  @{each.name}
                                </option>
                              ))}
                            </PlainSelect>
                          )}
                        </LineCell>
                        <LineCell className="w-28 text-right">
                          <SegmentedControl
                            ariaLabel={`Does this role carry ${permission.name}?`}
                            value={scope === undefined ? "no" : "yes"}
                            onChange={(next) => !disabled && carry(permission.name, next === "yes")}
                            segments={[
                              { value: "no", label: "—" },
                              { value: "yes", label: "Carry" },
                            ]}
                          />
                        </LineCell>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {namespaces.length === 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {showing === "carried" && filter.trim() === ""
            ? "This role carries nothing yet."
            : `Nothing matches “${filter}”.`}
        </p>
      )}
    </div>
  )
}

/**
 * Every capability the installation registers.
 *
 * ⚠️ From the **catalogue**, not from the document's `capabilities { }` block. The block declares only
 * what a tier could contain, so a picker built from it could not offer a free module — and a free module
 * is exactly what a `deny` is usually written about.
 */
export function CapabilitySelect({
  value,
  vocabulary,
  disabled,
  onChange,
}: {
  value: string
  vocabulary?: PolicyVocabularyView
  disabled: boolean
  onChange: (capability: string) => void
}) {
  return (
    <PlainSelect value={value} disabled={disabled} onChange={onChange}>
      <option value="">which capability?</option>
      {(vocabulary?.capabilities ?? []).map((capability) => (
        <option key={capability.key} value={capability.key}>
          {capability.label} — {capability.key}
        </option>
      ))}
    </PlainSelect>
  )
}

/** The scope chips a row summarises itself with — `@SPACE @SELF`, deduplicated and in order. */
export function ScopeChips({ scopes }: { scopes: string[] }) {
  const distinct = [...new Set(scopes)]

  if (distinct.length === 0) {
    return <RowMuted>—</RowMuted>
  }

  return (
    <ChipRow>
      {distinct.map((scope) => (
        <MonoBadge key={scope}>@{scope}</MonoBadge>
      ))}
    </ChipRow>
  )
}
