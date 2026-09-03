import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@jmouse/ui"
import { useQueryTransport, type ConditionRow, type QuerySubject } from "@jmouse/query"

/**
 * A value in a list that narrows the list to itself.
 *
 * <h2>⚠️ The browser never writes jMQ, so this is a button rather than a link</h2>
 *
 * <p>`@jmouse/query` is explicit that nothing in the browser composes or matches the language: the
 * builder sends **rows** and gets text back. A cell that built `manufacturer == "Vishay"` as a string
 * would be a second writer of a grammar that already has one, and two writers drift — they drifted far
 * enough once to compare a supplied value against its own name, silently.
 *
 * <p>So the click sends one condition row to be translated and navigates with what comes back. The cost
 * is a round trip per click, which is a click rather than a render; the alternative was pre-compiling a
 * query for every cell of every page, or writing the language here.
 *
 * <h2>⚠️ It narrows what is already narrowed, and refuses rather than rewrites</h2>
 *
 * <p>Clicking *Vishay* while the list is already filtered should add a condition, not replace one.
 * That means reading the current filter back into rows — and a filter the builder cannot draw
 * (`rows: null` — an expression, an `or`) must not be silently rewritten. Where it cannot be extended,
 * the value renders as plain text and offers nothing, which is honest; quietly discarding somebody's
 * expression to make room for a click is not.
 */
export function FilterableValue({
  subject,
  field,
  value,
  label,
  className,
  children,
}: {
  /** The listing being narrowed — `entriesOf(formId)`. */
  subject: QuerySubject
  /** The attribute to compare, as the query vocabulary names it. */
  field: string
  /** What this row holds, compared for equality. */
  value: string
  /**
   * ⚠️ **How the tooltip should READ — never how the filter is built.**
   *
   * <p>The condition compares the stored value against the field's own name, and must: that is the
   * vocabulary the server answers in. But a tooltip saying *«Show only where tolerance is 5»* about a
   * cell that plainly reads *±5%* describes a different screen than the one it is on. So the sentence is
   * written from what the reader can see, and the query from what the server knows.
   */
  label?: { field?: string; value?: string }
  className?: string
  children: React.ReactNode
}) {
  const [parameters, setParameters] = useSearchParams()
  const transport = useQueryTransport()
  const [working, setWorking] = useState(false)

  const current = parameters.get("jmq:filter")

  async function narrow(event: React.MouseEvent) {
    // ⚠️ The row underneath opens a preview. Without this one click does two things, and the one that
    // wins is whichever handler React reaches first — which is not a decision anybody made.
    event.stopPropagation()
    event.preventDefault()

    if (working) {
      return
    }
    setWorking(true)

    try {
      /**
       * ⚠️ **The attribute is the SUBJECT's name for the field, not the field's own.**
       *
       * An entry listing addresses a field as `entry[mount_type]` — the schema says so, and the field
       * is called `mount_type`. Sending the bare name is answered with **200** and
       * `"There is nothing called 'mount_type' here."`, which is how the first version of this put the
       * word `undefined` into the address bar.
       *
       * ⚠️ Composed here rather than read from the schema on every click, because it is the subject's
       * addressing convention rather than a per-field fact — but it is exactly the sort of convention
       * that should move into `@jmouse/query` the moment a second subject spells it differently.
       */
      const wanted: ConditionRow = {
        attribute: `entry[${field}]`,
        operator: "equals",
        value,
        // ⚠️ False: "show me the Vishay ones" does not mean "and the ones whose manufacturer is blank".
        includeMissing: false,
      }

      const existing = current ? await transport.translate(subject, { filter: current }) : null
      const drawable = existing === null || (existing.rows ?? null) !== null

      if (!drawable) {
        toast.error(
          "This list is filtered by an expression the builder cannot extend. Clear it, or add the "
          + "condition in the filter panel.",
        )
        return
      }

      const rows = [...(existing?.rows ?? []), wanted]
      const translated = await transport.translate(subject, { rows })

      /**
       * ⚠️ **A refusal here arrives as 200, so the answer has to be READ rather than trusted.**
       *
       * Translating something the subject does not recognise answers
       * `{ order: "", readable: false, message: "There is nothing called '…' here." }` — no `filter` key
       * at all. The first version took `translated.filter` on faith and navigated to
       * `?jmq:filter=undefined`: a list that silently showed everything, from a click that looked like
       * it had worked.
       */
      if (!translated?.filter) {
        toast.error(
          (translated as { message?: string })?.message
          ?? "That value could not be turned into a filter.",
        )
        return
      }

      setParameters(
        (previous) => {
          const next = new URLSearchParams(previous)

          next.set("jmq:filter", translated.filter)
          // Narrowing starts over — page three of the old answer is not page three of the new one.
          next.delete("page")

          return next
        },
        { replace: false },
      )
    } catch {
      toast.error("That filter could not be applied.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={narrow}
      disabled={working}
      title={`Show only where ${label?.field ?? field} is ${label?.value ?? value}`}
      className={cn(
        "hover:text-primary max-w-full cursor-pointer truncate text-left underline-offset-2 hover:underline",
        "focus-visible:ring-ring rounded-[2px] focus-visible:ring-2 focus-visible:outline-none",
        "disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  )
}
