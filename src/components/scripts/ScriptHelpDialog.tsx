import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@jmouse/ui"
import type { CompletionCatalogue } from "@jmouse/codemirror/completion"
import { scriptsApi } from "@/api/scripts"

/**
 * What a rule may say, and what this installation lets it reach.
 *
 * ## ⚠️ Half of this is prose and half is live, and the split is the whole design
 *
 * The **syntax** is the dialect's and changes with a framework release, so it is written here by hand.
 * The **API** is this build's — which events exist, which facades, which methods on each — and it is
 * fetched from `/scripts/catalogue`, the same endpoint the editor's completion reads.
 *
 * A hand-written API list would be wrong the first time somebody adds a facade, and wrong *silently*:
 * the reference would go on describing a product that no longer exists while the completion popup
 * quietly offered something else. Two lists of one fact always disagree; the only question is how long
 * it takes and who finds out. So there is one list, and this shows it.
 *
 * ## ⚠️ It opens without the catalogue
 *
 * The syntax half is what somebody stuck on a bracket needs, and it must not be held hostage to a
 * request. With the catalogue unreachable the API section says so plainly rather than showing an empty
 * list that reads as "this installation offers nothing".
 */

/** The syntax, by example. ⚠️ Every snippet here is one the binder accepts — not illustrative pseudo-code. */
const SYNTAX: { title: string; detail: string; code: string }[] = [
  {
    title: "A document is a script block",
    detail:
      "Handlers, functions and behaviours live inside it. Nothing is allowed at the top level — a bare handler is refused by the parser, which is the first thing most people get wrong.",
    code: `script "low-stock" {
    # everything goes in here
}`,
  },
  {
    title: "A handler runs on one event",
    detail:
      "The four events are the moments the form engine already had. A document may handle any number of them, and two documents may handle the same one — they run in the order the rail shows.",
    code: `on saving do
    # ...
end`,
  },
  {
    title: "when — the guard",
    detail:
      "Evaluated before the body. Where it is false the body does not run at all, which is how a rule about stock positions avoids running against every other form in the workspace.",
    code: `on saving when @stock.isPosition(entry) do
    # only for stock positions
end`,
  },
  {
    title: "Conditions",
    detail: "if / elseif / else / then / end. Comparisons and boolean operators are jMouse expressions.",
    code: `if @stock.quantity(entry) < 10 then
    @log.warn('running out')
elseif @stock.quantity(entry) < 50 then
    @log.info('getting low')
else
    @log.info('plenty')
end`,
  },
  {
    title: "Functions",
    detail:
      "Declared once in the document and called from any handler in it. The place to put a number you would otherwise repeat — a threshold written in three handlers is a threshold that will be changed in two.",
    code: `function floor()
    return 10
end`,
  },
  {
    title: "Locals and loops",
    detail:
      "⚠️ Every loop is bounded by the installation's ceiling — 5 000 iterations and 750 milliseconds for the whole script. A runaway rule fails in about a second rather than holding your save open.",
    code: `local held = @stock.quantity(entry)

for line in @project.linesFor(entry) do
    # ...
end`,
  },
  {
    title: "Comments",
    detail: "A # to the end of the line. Say why, not what — the code already says what.",
    code: `# Why this rule exists, in a sentence.`,
  },
]

/** What each event hands a handler, and what it is for. ⚠️ Kept beside the live catalogue, never instead of it. */
const EVENT_NOTES: Record<string, string> = {
  saving:
    "About to replace an entry's values. ⚠️ The UPDATE path only — a new entry reaches `created` instead. Throwing here refuses the write.",
  created: "An entry has just been stored for the first time. Not vetoable.",
  changed: "An entry's values have just been rewritten. Not vetoable.",
  deleting: "About to be deleted. Object by naming what you keep — the phrase reaches the person deleting it.",
}

export function ScriptHelpDialog({ onClose }: { onClose: () => void }) {
  const catalogue = useQuery<CompletionCatalogue | null>({
    queryKey: ["scripts", "catalogue"],
    queryFn: () => scriptsApi.catalogue().then((response) => response.data).catch(() => null),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Writing a rule</DialogTitle>
          <DialogDescription>
            The syntax, and what this installation lets a rule reach. The API below is read from the
            server, so it is what your rules can actually call today — not what the manual last said.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Syntax
            </h3>

            <div className="grid gap-3 lg:grid-cols-2">
              {SYNTAX.map((item) => (
                <article key={item.title} className="border p-3">
                  <h4 className="text-sm font-medium">{item.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  <pre className="mt-2 overflow-x-auto border-t pt-2 font-mono text-xs">{item.code}</pre>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Events
            </h3>

            {/* ⚠️ The context names are the point of this table. A handler that reads a name the event
                does not carry gets nothing — silently — and this is the only place that says which
                names each event actually sets. */}
            <table className="w-full border text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 font-medium">Event</th>
                  <th className="p-2 font-medium">Hands you</th>
                  <th className="p-2 font-medium">What it is</th>
                </tr>
              </thead>
              <tbody>
                {(catalogue.data?.events ?? []).map((event) => (
                  <tr key={event.name} className="border-b align-top">
                    <td className="p-2 font-mono">{event.name}</td>
                    <td className="p-2 font-mono">
                      {(event.context ?? []).join(", ") || "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {EVENT_NOTES[event.name] ?? event.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Facades — everything a rule may reach
            </h3>

            {catalogue.data === null && (
              <p className="text-xs text-warning">
                The catalogue could not be read, so this list is unavailable. Rules still save and run —
                only the list and the completion popup are missing.
              </p>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              {(catalogue.data?.facades ?? []).map((facade) => (
                <article key={facade.name} className="border p-3">
                  <h4 className="font-mono text-sm">@{facade.name}</h4>
                  {facade.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">{facade.detail}</p>
                  )}

                  <ul className="mt-2 border-t pt-2 font-mono text-xs">
                    {(facade.methods ?? []).map((method) => (
                      <li key={`${method.name}/${method.arity}`} className="flex gap-2">
                        <span>
                          @{facade.name}.{method.name}({method.arity === 0 ? "" : `${method.arity} arg${method.arity === 1 ? "" : "s"}`})
                        </span>
                        {method.detail && (
                          <span className="text-muted-foreground">{method.detail}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            {/* ⚠️ Said once, loudly, because it is the trap that costs an entry write to learn. */}
            <p className="mt-3 border p-3 text-xs">
              ⚠️ A call is resolved by <strong>name and argument count</strong>, never by type. Two
              methods of one name taking the same number of arguments are an ambiguity the host refuses
              — and it refuses while your rule is running, not while you are writing it.
            </p>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
              What a rule cannot do
            </h3>

            <ul className="border p-3 text-xs text-muted-foreground">
              <li>
                Reach anything not listed above. The catalogue is the whole of it — there is no way to
                get at a database, a file or another workspace.
              </li>
              <li className="mt-1">
                Run for long. 20 000 steps, 5 000 loop iterations, depth 32, 750 ms — set by the
                installation and not raisable from a document.
              </li>
              <li className="mt-1">
                Fail quietly. ⚠️ A rule that throws takes the entry write with it, deliberately: a rule
                that half ran is worse than a save that did not happen.
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
