import { useMemo, useState } from "react"
import { Badge, Input, cn, useTheme } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { SegmentedControl } from "@/components/SegmentedControl"
import { ORIGINS, SpecimenCard, type KitSection, type SpecimenOrigin } from "./Specimen"
import { actionsSection } from "./sections/actions"
import { fieldsSection } from "./sections/fields"
import { foundationsSection } from "./sections/foundations"
import { layersSection } from "./sections/layers"
import { listsSection } from "./sections/lists"
import { marksSection } from "./sections/marks"
import { shellSection } from "./sections/shell"

/**
 * **jMouse UI** — every part this interface is built from, with the name we call it.
 *
 * ⚠️ **This page talks to nothing.** No request, no permission, no workspace: it renders the kit and
 * nothing else, so it works against a backend that is down and answers the one question it exists for
 * without any state to be in.
 *
 * ⚠️ **The names are the deliverable, not the swatches.** A conversation about an interface is a
 * conversation about parts, and two people without shared names for them end up describing pixels —
 * *"the grey pill thing on the right"*. Every specimen carries a short slug, and it copies on a click, so
 * a request can say **`row/carded`** and mean exactly one thing.
 *
 * ⚠️ **Every part also says where it comes from, and that is one of four answers rather than a
 * sentence.** `library` is shared by three interfaces, `product` is this one alone, `vendor` is somebody
 * else's package, `composed` has nothing to import at all. The distinction is what says whether changing
 * a thing is a local edit or a change to Tessera and Kiwi as well — and a free-text note could not be
 * counted, filtered, or trusted. The tally under the header is that answer for the whole kit.
 *
 * ⚠️ **A part is here because it is USED, not because the library exports it.** A kit that lists
 * everything available is a catalogue; this lists what the three products actually paint with, which is
 * what makes an absence meaningful — nothing here is a suggestion.
 */
const SECTIONS: KitSection[] = [
  foundationsSection,
  shellSection,
  actionsSection,
  fieldsSection,
  listsSection,
  marksSection,
  layersSection,
]

const ALL_SPECIMENS = SECTIONS.flatMap((section) => section.specimens)

const ORIGIN_ORDER: SpecimenOrigin[] = ["library", "product", "composed", "vendor"]

const ORIGIN_TALLY = ORIGIN_ORDER.map((origin) => ({
  origin,
  count: ALL_SPECIMENS.filter((specimen) => specimen.origin === origin).length,
}))

export function UiKitPage() {
  const [search, setSearch] = useState("")
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [origin, setOrigin] = useState<SpecimenOrigin | null>(null)

  const { mode, setMode } = useTheme()

  const needle = search.trim().toLowerCase()

  /**
   * ⚠️ **Searching — or asking for one origin — drops the section navigation rather than filtering
   * inside it.** A list of headings where five of seven are empty is worse than one long answer, and
   * what somebody typing a name wants is the specimen, not the group it happens to live in.
   *
   * ⚠️ **The origin and the path are searchable too**, so `@jmouse/ui` answers *what is shared* and
   * `PolicyEditingKit` answers *what else came out of that one file* — both questions this page is asked.
   */
  const matching = useMemo(() => {
    if (needle === "" && origin === null) {
      return null
    }

    return ALL_SPECIMENS.filter(
      (specimen) =>
        (origin === null || specimen.origin === origin) &&
        (needle === "" ||
          specimen.name.toLowerCase().includes(needle) ||
          specimen.origin.includes(needle) ||
          specimen.from.toLowerCase().includes(needle) ||
          (specimen.symbol ?? "").toLowerCase().includes(needle) ||
          specimen.what.toLowerCase().includes(needle)),
    )
  }, [needle, origin])

  const shown = openKey ? SECTIONS.filter((section) => section.key === openKey) : SECTIONS

  return (
    <>
      <PageHeader
        title="jMouse UI"
        description="Every part this interface is built from — what we call it, and where it comes from"
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Find a part…"
              onChange={(event) => setSearch(event.target.value)}
            />
            {/* ⚠️ Here rather than in the account's appearance screen: a kit whose contrast can only be
                checked by leaving it is a kit nobody checks the dark half of. */}
            <SegmentedControl
              ariaLabel="Colour mode"
              value={mode}
              onChange={setMode}
              segments={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </>
        }
      />

      {/* ⚠️ The tally is a control, not a caption. "Which of these are shared?" is the question this page
          was failing to answer, and a reader who can press the word gets the list rather than a number. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button"
          onClick={() => setOrigin(null)}
          className={cn(
            "rounded-md px-2 py-1 text-xs",
            origin === null ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          Everything
          <span className="ml-1.5 font-mono text-[10px]">{ALL_SPECIMENS.length}</span>
        </button>

        {ORIGIN_TALLY.map((tally) => (
          <button
            key={tally.origin}
            type="button"
            title={ORIGINS[tally.origin].what}
            onClick={() => setOrigin(origin === tally.origin ? null : tally.origin)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
              origin === tally.origin ? ORIGINS[tally.origin].className : "border-transparent hover:bg-accent/50",
            )}
          >
            <span aria-hidden="true" className={cn("size-2 rounded-full border", ORIGINS[tally.origin].className)} />
            {ORIGINS[tally.origin].label}
            <span className="font-mono text-[10px] opacity-70">{tally.count}</span>
          </button>
        ))}

        <span className="w-full text-[11px] text-muted-foreground sm:w-auto sm:flex-1">
          {origin === null ? "Every card names its origin and the exact thing to import." : ORIGINS[origin].what}
        </span>
      </div>

      {matching ? (
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted-foreground">
            {matching.length} of {ALL_SPECIMENS.length} parts
            {origin !== null && <> are {ORIGINS[origin].label}</>}
            {needle !== "" && <> match “{search}”</>}
          </span>
          {matching.map((specimen) => (
            <SpecimenCard key={specimen.name} specimen={specimen} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-2">
            <button
              type="button"
              onClick={() => setOpenKey(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                openKey === null ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              Everything
              <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
                {ALL_SPECIMENS.length}
              </Badge>
            </button>

            {SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setOpenKey(section.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  openKey === section.key ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <span className="truncate">{section.label}</span>
                <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
                  {section.specimens.length}
                </Badge>
              </button>
            ))}
          </nav>

          <div className="flex min-w-0 flex-col gap-6">
            {shown.map((section) => (
              <section key={section.key} className="flex flex-col gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{section.label}</h2>
                  <p className="text-xs text-muted-foreground">{section.about}</p>
                </div>

                {section.specimens.map((specimen) => (
                  <SpecimenCard key={specimen.name} specimen={specimen} />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
