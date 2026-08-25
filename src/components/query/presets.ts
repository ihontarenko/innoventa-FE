import type { QueryPreset } from "@jmouse/query"

/**
 * The questions people ask before they think of writing one.
 *
 * ## ⚠️ Offered only when the schema can actually answer them
 *
 * A preset names attributes, and a form that has no `quantity` cannot answer *"running low"*. So each one
 * declares what it needs and is **filtered against the schema the server sent** — an unusable preset is
 * never shown rather than shown and then refused. That is the whole reason a preset is data here and not
 * a hard-coded row of chips.
 *
 * ## ⚠️ They fill the box; they do not apply themselves
 *
 * Clicking one writes its text into the panel, where it can be read, edited and understood before
 * anything runs. A chip that silently changed the list would be a filter nobody could see — which is the
 * thing saved views and this whole cluster exist to stop.
 *
 * ## ⚠️ The filter is jMQ; the sort is not
 *
 * A filter is a query somebody could have typed, so it is stored as one. A sort is two facts the panel
 * already knows how to write — which attribute, and which way — so a preset states those and lets the
 * one writer write it. Storing sort text here would be a second place that has to agree about a pipe.
 */
/* ⚠️ The SHAPE is the package's; only these lists are Innoventa's. See `@jmouse/query`. */

/**
 * ⚠️ `entry[quantity]` is untyped in the bag, so every preset that compares it writes `| int` — exactly
 * as the builder does. A preset is not exempt from the rule that stopped `"900" > "1000"`.
 */
const INVENTORY_PRESETS: readonly QueryPreset[] = [
  {
    label: "Running out",
    explains: "Fewer than ten in stock",
    needs: ["entry[quantity]"],
    filter: "entry[quantity] | int < 10",
    sort: { by: "entry[quantity]" },
  },
  {
    label: "Nothing left",
    explains: "Zero in stock — what to order first",
    needs: ["entry[quantity]"],
    filter: "entry[quantity] | int == 0",
  },
  {
    label: "No quantity",
    explains: "Rows where no quantity was recorded at all",
    needs: ["entry[quantity]"],
    filter: "entry[quantity] is null",
  },
  {
    label: "Added this week",
    explains: "Everything that appeared in the last seven days",
    needs: ["created"],
    filter: "created > now() - days(7)",
    sort: { by: "created", descending: true },
  },
  {
    label: "Mine",
    explains: "The rows you recorded yourself",
    needs: ["submitter"],
    filter: "submitter == currentMember",
  },
]

/**
 * ⚠️ Equipment's presets lean on the asset's OWN facts — its state, and when it came under watch —
 * because those are the only ones that mean the same thing whatever form describes the thing.
 */
const EQUIPMENT_PRESETS: readonly QueryPreset[] = [
  {
    label: "Out on loan",
    explains: "Given to somebody and not back yet",
    needs: ["asset[state]"],
    filter: "asset[state] == 'ISSUED'",
  },
  {
    label: "Available",
    explains: "What can be taken right now",
    needs: ["asset[state]"],
    filter: "asset[state] == 'AVAILABLE'",
  },
  {
    label: "In for repair",
    explains: "Out of circulation — servicing or repair",
    needs: ["asset[state]"],
    filter: "asset[state] == 'IN_SERVICE'",
  },
  {
    label: "Written off",
    explains: "No longer in circulation — the history stays, the movements stop",
    needs: ["asset[state]"],
    filter: "asset[state] == 'WRITTEN_OFF'",
  },
  {
    label: "Newly watched",
    explains: "Brought under watch in the last thirty days",
    needs: ["asset[watched]"],
    filter: "asset[watched] > now() - days(30)",
    sort: { by: "asset[watched]", descending: true },
  },
  {
    label: "Untouched for a long time",
    explains: "Nothing has changed in over six months",
    needs: ["asset[updated]"],
    filter: "asset[updated] < now() - months(6)",
    sort: { by: "asset[updated]" },
  },
]

/**
 * ⚠️ Keyed by the SUBJECT the server registered — `entries`, `assets` — not by a word this file invents.
 * A key nobody publishes silently offers no presets, which is indistinguishable from a form that cannot
 * answer any of them.
 */
const BY_SUBJECT: Record<string, readonly QueryPreset[]> = {
  entries: INVENTORY_PRESETS,
  assets: EQUIPMENT_PRESETS,
}

/**
 * The presets this subject and this schema can actually answer.
 *
 * ⚠️ An unusable one is **dropped silently**, and that is right: somebody who never had `quantity` on
 * their form never wondered where *"running out"* went, and a disabled chip explaining why would be an
 * apology for a feature they never asked for.
 *
 * ⚠️ A subject nobody wrote presets for gets none rather than somebody else's — the presets are the one
 * part of this panel that is genuinely about what is being listed.
 */
export function presetsFor(subject: string): readonly QueryPreset[] {
  return BY_SUBJECT[subject] ?? []
}
