import { useNavigate } from "react-router-dom"
import { Button } from "@jmouse/ui"
import { useMonitoringModule, useWatchState } from "@/hooks/useMonitoring"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * An empty attention board, saying which empty it is.
 *
 * ⚠️ **This is the sentence the product was judged by.** For every new workspace, *"Nothing needs you"*
 * was the first and only thing the watch ever said — true, and indistinguishable from *nothing is
 * configured and nothing ever will need you*. Ivan, opening it: *«не зрозуміло його корисить, як
 * користуватись»*. The board was not wrong; it was unanswerable.
 *
 * ⚠️ **It lives beside the feature, not inside the screen.** `AttentionPage` knows of no feature by
 * design — it renders groups with a label and items with a weight, and an architecture test keeps the
 * backend's half of that bargain. So the screen renders a slot; what fills the slot is monitoring's, and
 * the question it asks is *is anything configured at all*, never *is there a maintenance plan*.
 */
export function NothingNeedsYou() {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((store) => store.activeSpaceSlug)

  const watchesEquipment = useMonitoringModule()
  const { data: state } = useWatchState()

  function go(section: string) {
    if (spaceSlug) {
      navigate(spaceSectionPath(spaceSlug, section))
    }
  }

  // A workspace that only says who holds what has nothing to put on this board and never will, so the
  // calm sentence is the honest one — there is no setup being withheld.
  if (!watchesEquipment || !state) {
    return <Calm />
  }

  if (state.metrics === 0 && state.plans === 0) {
    return (
      <Empty
        glyph="⚙"
        title="Nothing is being watched yet"
        body={
          <>
            The watch answers what state a thing is in — hours run, checks passed, service due. It starts
            with a <strong>number you collect</strong> (motorhours, temperature, prints) and a{" "}
            <strong>rule about it</strong> ("every 250 hours", "never below 2 °C"). Both are written per
            class of thing, and everything either of them notices arrives here.
          </>
        }
        action={
          <Button size="sm" onClick={() => go("watch")}>
            Set up the watch
          </Button>
        }
      />
    )
  }

  if (state.watchedThings === 0) {
    return (
      <Empty
        glyph="⛭"
        title="Nothing to watch yet"
        body={
          <>
            {/* ⚠️ **The counts are said, not summarised into "the rules are written".** A workspace with
                metrics and no rules would be told its rules were written, which is the kind of small
                lie that teaches somebody to stop reading a product's own sentences. */}
            This workspace measures {countOf(state.metrics, "number", "numbers")} and carries{" "}
            {countOf(state.plans, "rule", "rules")} — but it has no things for them to govern yet.
            Register one and it starts collecting its own history from that moment.
            {state.plans === 0 && (
              <>
                {" "}
                A number on its own records history and raises nothing; the rule about it is what makes
                something fall due.
              </>
            )}
          </>
        }
        action={
          <Button size="sm" onClick={() => go("assets")}>
            Register a thing
          </Button>
        }
      />
    )
  }

  return <Calm />
}

/** "no rules", "1 rule", "4 rules" — a zero says zero rather than being hidden behind a plural. */
function countOf(howMany: number, one: string, many: string) {
  if (howMany === 0) {
    return `no ${many}`
  }

  return `${howMany} ${howMany === 1 ? one : many}`
}

/** ⚠️ The goal state, and it has to read like an answer rather than like a screen that failed to load. */
function Calm() {
  return (
    <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      Nothing needs you. Nothing is overdue, nothing is out of bounds, and every number somebody expected
      has been written down.
    </p>
  )
}

function Empty({
  glyph,
  title,
  body,
  action,
}: {
  glyph: string
  title: string
  body: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        {glyph}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{body}</span>
      <div className="mt-2">{action}</div>
    </div>
  )
}
