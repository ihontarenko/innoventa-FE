import { useSearchParams } from "react-router-dom"
import { Badge, cn } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { PolicyCodePane } from "@/components/access/PolicyCodePane"
import { PolicyDocumentPane, type DocumentBlock } from "@/components/access/PolicyDocumentPane"
import { PolicyResolvedPane, PolicyShippedPane } from "@/components/access/PolicyReadingPane"
import { PolicyDryRun, PolicyHistory, PolicyProblems, PolicyToolbar } from "@/components/access/PolicyToolbar"
import { SimulatePanel } from "@/components/access/SimulatePanel"
import { WhatPanel } from "@/components/access/WhatPanel"
import { WhoPanel } from "@/components/access/WhoPanel"
import { usePolicyWorkbench } from "@/hooks/usePolicyWorkbench"
import type { PolicyDocumentView, PolicyOverrideSeed } from "@/api/policy"

/**
 * The screen that answers **why can Nick do this**, and the one that changes the answer.
 *
 * There were four administration screens before it — users and roles, workspaces, plans, workspace
 * members — and not one showed an *effective* answer. Each showed an **input**. The question a person
 * actually has was answerable only by somebody holding the whole model in their head.
 *
 * ⚠️ **Three levels of navigation are one flat list.** A tab strip chose between Policy, Who, What and
 * Simulate; inside Policy a segmented control chose between five surfaces; inside the form surface a
 * side panel chose between the document's five blocks. Reaching the entitlements list meant three
 * gestures through three differently-shaped controls, and nothing on screen said the third one existed.
 */
export type Destination =
  | "subjects"
  | "roles"
  | "capabilities"
  | "plans"
  | "entitlements"
  | "code"
  | "inForce"
  | "shipped"
  | "history"
  | "who"
  | "what"
  | "simulate"

interface DestinationOption {
  key: Destination
  label: string
  glyph: string
  /** Names the group this destination opens. Absent where it continues the one above. */
  group?: string
  /** Why this destination exists, since one word cannot carry it. */
  title: string
  /**
   * Which block of the document this destination edits, where it edits one.
   *
   * ⚠️ Its presence is also what puts the **count** beside the entry: a navigation reading *Roles* and
   * one reading *Roles · 7* answer different questions, and the second is the one somebody arriving at
   * this screen actually has. It is read off the **unsaved** document, so a block that just grew a line
   * says so before anything is applied.
   */
  block?: DocumentBlock
}

const DESTINATIONS: DestinationOption[] = [
  // ⚠️ The document's five blocks come first because changing the answer is why people open the screen.
  // Landing on *Who* meant every visit began by looking up a person nobody wanted to look up.
  { key: "subjects", label: "Subjects", glyph: "◎", title: "What one account holds, and where", block: "subjects" },
  { key: "roles", label: "Roles", glyph: "◇", title: "What a bundle carries, and how far", block: "roles" },
  { key: "capabilities", label: "Capabilities", glyph: "◈", title: "What a tier may contain", block: "capabilities" },
  { key: "plans", label: "Plans", glyph: "◧", title: "What each tier includes", block: "plans" },
  {
    key: "entitlements",
    label: "Entitlements",
    glyph: "◫",
    title: "Who is on what, and until when",
    block: "entitlements",
  },

  // ⚠️ Named by what a reader may *do*. "Code" said what the surface is made of and left somebody to
  // guess whether typing in it changed anything.
  {
    key: "code",
    label: "Edit as .jmp",
    glyph: "⌨",
    group: "Whole document",
    title: "The same document as text — the real parser lints it as you type, and Apply writes rows",
  },
  {
    key: "inForce",
    label: "Resolved",
    glyph: "≡",
    title: "Everything the engine resolves from — derived, read-only",
  },
  {
    key: "shipped",
    label: "Reference",
    glyph: "◰",
    title: "What came with the application — read-only either way",
  },
  {
    key: "history",
    label: "History",
    glyph: "◷",
    title: "Every version that ever was, and one click back to it",
  },

  { key: "who", label: "Who", glyph: "☺", group: "Answers", title: "Everything one person effectively holds" },
  { key: "what", label: "What", glyph: "⌕", title: "Everybody who holds one permission" },
  {
    key: "simulate",
    label: "Simulate",
    glyph: "⚖",
    title: "Run the real decision and see which axis answered",
  },
]

/**
 * ⚠️ **Subjects, and that is the order arguing rather than an accident.** The five blocks are listed
 * first because changing the answer is why people open this screen; landing anywhere else would mean
 * every visit began by scrolling past the thing most visits are about.
 */
const DEFAULT_DESTINATION = DESTINATIONS[0]

/** The destinations the policy toolbar and the parser's complaints belong above. */
const POLICY_DESTINATIONS = new Set<Destination>([
  "subjects",
  "roles",
  "capabilities",
  "plans",
  "entitlements",
  "code",
  "history",
])

function destinationFrom(parameter: string | null): DestinationOption {
  return DESTINATIONS.find((option) => option.key === parameter) ?? DEFAULT_DESTINATION
}

/** How many lines each block holds — read off the document being edited, not off the saved one. */
function countIn(document: PolicyDocumentView | null, block: DocumentBlock): number | null {
  return document ? document[block].length : null
}

export function AccessControlRoomPage() {
  /**
   * ⚠️ **The open destination is in the address, not in a `useState`.** Twelve panels behind one URL
   * meant *"look at what this deny does to Petro"* could only be sent as a screenshot, the back button
   * undid the whole visit rather than the last move, and a reload always landed somewhere other than
   * where the reader was. `replace` keeps it from filling the history with one entry per click — the
   * address describes the screen, it is not a step in it.
   */
  const [parameters, setParameters] = useSearchParams()
  const destination = destinationFrom(parameters.get("view"))

  // ⚠️ Held here rather than inside a panel: the toolbar, the problems band and the counts beside the
  // document destinations are all about the same unsaved document, and a workbench owned by one panel
  // would unmount whenever somebody looked at the history.
  const workbench = usePolicyWorkbench()

  function open(next: Destination) {
    setParameters({ view: next }, { replace: true })
  }

  /**
   * ⚠️ **Overriding is a navigation, not an action.** It composes the `deny` that overrides a grant and
   * drops it into the document unsaved, so it still goes through the rehearsal and still needs a Save.
   * Applying it silently from the *Who* view would be exactly the disappearance this whole model
   * refuses — so the reader is taken to the line that was just written, to read it.
   */
  function overrideInPolicy(seed: PolicyOverrideSeed) {
    workbench.override(seed)
    open("subjects")
  }

  return (
    <>
      <PageHeader
        title="Access control"
        description="Why one person may do one thing — and the document that decides it"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-2">
          {DESTINATIONS.map((option) => {
            const count = option.block ? countIn(workbench.document, option.block) : null

            return (
              <div key={option.key}>
                {option.group && (
                  <div className="mt-3 mb-1 px-2 text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
                    {option.group}
                  </div>
                )}
                <button
                  type="button"
                  title={option.title}
                  onClick={() => open(option.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    destination.key === option.key
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-accent/50",
                  )}
                >
                  <span aria-hidden="true" className="w-4 shrink-0 text-center">
                    {option.glyph}
                  </span>
                  <span className="truncate">{option.label}</span>
                  {/* ⚠️ `text-current`, because `variant="outline"` pins `text-foreground` — which is
                      the light ink the sidebar is written in, and the open destination's background is
                      the light one. The count came out invisible on exactly the row somebody is
                      looking at. */}
                  {count !== null && (
                    <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
                      {count}
                    </Badge>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="min-w-0">
          <p className="mb-3 text-xs text-muted-foreground">{destination.title}</p>

          {POLICY_DESTINATIONS.has(destination.key) && (
            <div className="mb-3 flex flex-col gap-2">
              <PolicyToolbar workbench={workbench} />
              <PolicyProblems workbench={workbench} />
              <PolicyDryRun workbench={workbench} />
            </div>
          )}

          {destination.block && <PolicyDocumentPane block={destination.block} workbench={workbench} />}

          {destination.key === "who" && <WhoPanel onOverride={overrideInPolicy} />}
          {destination.key === "what" && <WhatPanel />}
          {destination.key === "simulate" && <SimulatePanel />}

          {destination.key === "code" && (
            <PolicyCodePane source={workbench.source} onChange={workbench.editSource} readOnly={!workbench.mayWrite} />
          )}
          {destination.key === "inForce" && <PolicyResolvedPane />}
          {destination.key === "shipped" && <PolicyShippedPane workbench={workbench} />}
          {destination.key === "history" && <PolicyHistory workbench={workbench} />}
        </div>
      </div>
    </>
  )
}
