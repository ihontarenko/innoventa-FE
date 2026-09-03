import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  DetailsPanel,
  type FilterItem,
  useDetailsPanel,
} from "@jmouse/ui"
import { DataTable } from "@/components/layout/DataTable"
import { ListScreen } from "@/components/layout/ListScreen"
import { ViewBar } from "@/components/ViewBar"
import { AssetPanel } from "@/components/custody/AssetPanel"
import { RegisterAssetDialog } from "@/components/custody/RegisterAssetDialog"
import { ScanDialog } from "@/components/custody/ScanDialog"
import { useAssetForms, useAssets } from "@/hooks/useCustody"
import { QueryPanel } from "@jmouse/query"
import { assetsOf } from "@/components/query/subjects"
import { QUERY_LABELS } from "@/components/query/labels"
import { useMaintenanceBoard } from "@/hooks/useMonitoring"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
import { useAddress } from "@/hooks/useAddress"
import type { DueState } from "@/api/monitoring"
import { custodyApi } from "@/api/custody"
import { LabelPrintButton } from "@/components/labels/LabelPrintButton"
import { LABEL_RUN_PROBE } from "@/lib/labels/labelPrinting"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { relativeMoment } from "@/lib/dates"
import type { Asset, AssetFilter, AssetState } from "@/api/custody"
const PAGE_SIZE = 25
/**
 * The four states a thing can be in.
 *
 * ⚠️ **`IN_SERVICE` is not a kind of `AVAILABLE`.** Something returned broken is out of circulation
 * until somebody deals with it, and a board that folded the two together would keep offering a bench
 * meter that is sitting in a repair pile.
 */
const STATES: Array<{ value: AssetState; glyph: string; label: string; what: string }> = [
  { value: "AVAILABLE", glyph: "◉", label: "Available", what: "On a shelf, ready to be taken out." },
  { value: "ISSUED", glyph: "→", label: "Issued", what: "Somebody has it." },
  { value: "IN_SERVICE", glyph: "🔧", label: "In service", what: "Came back needing attention." },
  { value: "WRITTEN_OFF", glyph: "✕", label: "Written off", what: "Off the books for good." },
]
const STATE_GLYPHS = Object.fromEntries(STATES.map((state) => [state.value, state.glyph])) as Record<
  AssetState,
  string
>
/**
 * What the workspace holds, and who has it right now.
 *
 * ⚠️ **The filters go to the server, not to the page in hand.** A board is paged, so narrowing it in the
 * browser would answer "three issued" out of the twenty-five rows that happened to be loaded — which is
 * the one number somebody actually acts on.
 *
 * ⚠️ **Overdue is a chip rather than a state.** A thing can be issued *and* overdue; making it a fifth
 * state would mean the states no longer partition the board, and every count would stop adding up.
 */
export function AssetsPage() {
  /**
   * Every narrowing this board applies — **in the address**.
   *
   * <h2>⚠️ All of it lived in `useState`, so the board had one address for every view of it</h2>
   *
   * <p>*The overdue instruments, page two* was not something anybody could link to, keep open in a second
   * tab, or return to after opening a record: leaving and coming back landed on the unfiltered first page
   * with nothing to say a filter had been dropped. Ivan asked for the opposite in as many words — the
   * filters that are not a saved view still belong in the URL.
   *
   * <p>Transient things stay state: which panel is open, whether the scanner is up, what is half-typed.
   * The rule is whether somebody could reasonably send it to somebody else.
   */
  const { parameters, amend, query: jmq, setQuery: setJmq } = useAddress()
  const page = Math.max(0, Number(parameters.get("page") ?? "1") - 1)
  const state = (parameters.get("state") as AssetState | null) ?? undefined
  const formId = parameters.get("form") ?? undefined
  const overdueOnly = parameters.get("overdue") === "1"
  const setPage = (next: number) => amend({ page: next <= 0 ? null : String(next + 1) })
  const setState = (next: AssetState | undefined) => amend({ state: next ?? null, page: null })
  const setFormId = (next: string | undefined) => amend({ form: next ?? null, page: null })
  const setOverdueOnly = (next: boolean) => amend({ overdue: next ? "1" : null, page: null })
  /* ⚠️ **The same peek Inventory opens, not a modal sheet.** It was a `Sheet` that dimmed the list
     behind it while Inventory showed the same kind of thing as a third full-height column — the exact
     difference Ivan pointed an arrow at. `useDetailsPanel` decides column-or-overlay by width, so a
     phone still gets a sheet and a desktop never does. */
  const peek = useDetailsPanel<string>()
  const [registering, setRegistering] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  /**
   * ⚠️ **What is typed stays local; what is SEARCHED goes to the address.** Writing every keystroke into
   * the URL puts a history entry behind each letter and re-renders the address bar as somebody types.
   */
  const [typed, setTyped] = useState(parameters.get("q") ?? "")
  // ⚠️ Debounced because this one is a *server* filter — a request per keystroke against a paged board.
  const query = useDebouncedValue(typed.trim(), 300)
  useEffect(() => {
    if (query !== (parameters.get("q") ?? "")) {
      amend({ q: query || null, page: null })
    }
  }, [query])
  const filter: AssetFilter = useMemo(
    () => ({
      state,
      formId,
      overdue: overdueOnly || undefined,
      query: query || undefined,
    }),
    [state, formId, overdueOnly, query],
  )
  const { data, isLoading } = useAssets(filter, page, PAGE_SIZE, jmq)
  const { data: assetForms = [] } = useAssetForms()
  const assets = data?.content ?? []
  /**
   * ⚠️ **Half of what a thing's state is was invisible here.** The row painted *due back* — custody's
   * question — while an excavator forty hours past its oil change looked exactly like one serviced
   * yesterday. This is the other half, and it is the board somebody actually scans.
   *
   * ⚠️ **The workspace's whole derivation, once, rather than a question per row.** Every answer is
   * computed on read, so twenty-five row-sized requests would derive the same plans twenty-five times;
   * this is the one call the Maintenance screen already makes and react-query already holds.
   */
  const watch = useWatchStateByAsset()
  // What this workspace calls them. The English is the fallback and is what paints before the words land.
  const term = useTerm()
  const things = term("thing.many", "things")
  const thing = term("thing.one", "thing")
  useViewFromAddress<AssetFilter & { query?: string }>("assets", (applied, viewId) => {
    setState(applied.state)
    setFormId(applied.formId)
    setOverdueOnly(Boolean(applied.overdue))
    setTyped(applied.query ?? "")
    setPage(0)
    setActiveViewId(viewId)
  })
  const filterItems: FilterItem[] = [
    ...STATES.map((one) => ({ key: `state:${one.value}`, icon: one.glyph, label: one.label })),
    ...assetForms.map((form, index) => ({
      key: `form:${form.id}`,
      icon: form.icon ?? "▣",
      label: form.name,
      dividerLabel: index === 0 ? "Kind" : undefined,
    })),
  ]
  const activeKey = state ? `state:${state}` : formId ? `form:${formId}` : null
  function choose(key: string | null) {
    setPage(0)
    // ⚠️ Narrowing by hand un-claims the view: the filter is no longer what it stored.
    setActiveViewId(null)
    if (!key) {
      setState(undefined)
      setFormId(undefined)
      return
    }
    if (key.startsWith("state:")) {
      setState(key.slice(6) as AssetState)
      setFormId(undefined)
      return
    }
    setFormId(key.slice(5))
    setState(undefined)
  }
  return (
    <>
      <ListScreen
        title={capitalised(things)}
        description={`${data?.totalElements ?? 0} ${things} — where they are and who has them`}
        search={{
          value: typed,
          placeholder: `Search ${things}… ( / )`,
          onChange: (value) => {
            setTyped(value)
            setPage(0)
            setActiveViewId(null)
          },
        }}
        chips={[
          { label: "Filter", active: composing, onClick: () => setComposing((previous) => !previous) },
          {
            label: "Overdue",
            active: overdueOnly,
            title: "Only things that were due back already",
            onClick: () => {
              setOverdueOnly(!overdueOnly)
              setPage(0)
              setActiveViewId(null)
            },
          },
        ]}
        action={{ label: `Register ${thing}`, onClick: () => setRegistering(true) }}
        extraActions={
          <>
            {/* ⚠️ Batch is by FILTER, not by selection — the filters already on this screen answer
                "which forty", so this is one button rather than forty checkboxes. */}
            <LabelPrintButton
              formId={formId}
              permission="custody:read"
              subject={overdueOnly ? "Everything overdue" : "The whole filter"}
              resolveIds={async () => {
                const whole = await custodyApi
                  .assets(0, LABEL_RUN_PROBE, filter)
                  .then((response) => response.data)
                return whole.content.map((asset) => asset.id)
              }}
            />
            {/* ⚠️ Beside the search rather than instead of it: a scan is one more way to select a
                thing, never a second flow. What it resolves to opens the drawer everything else
                opens. */}
            <Button size="sm" variant="outline" onClick={() => setScanning(true)}>
              Scan
            </Button>
          </>
        }
        banner={
          composing ? (
            <QueryPanel
              subject={assetsOf(formId)}
              query={jmq}
              labels={QUERY_LABELS}
              placeholder="asset[state] == 'AVAILABLE'"
              onApply={(applied) => {
                setJmq(applied)
                setPage(0)
                setActiveViewId(null)
              }}
            />
          ) : undefined
        }
        rail={{
          title: "State",
          items: filterItems,
          activeKey: activeKey,
          onSelect: choose,
          allLabel: "Everything",
          allIcon: "☰",
          allCount: data?.totalElements,
        }}
        toolbar={
          <ViewBar
            section="assets"
            filter={{ state, formId, overdue: overdueOnly, query: typed }}
            isFiltered={Boolean(state || formId || overdueOnly || typed.trim())}
            activeViewId={activeViewId}
            onApply={(applied, viewId) => {
              setState(applied.state)
              setFormId(applied.formId)
              setOverdueOnly(Boolean(applied.overdue))
              setTyped(applied.query ?? "")
              setPage(0)
              setActiveViewId(viewId)
            }}
          />
        }
        loading={isLoading && assets.length === 0}
        isEmpty={assets.length === 0}
        empty={{
          title: `No ${things} yet`,
          text: `A ${thing} is a *particular* object — this meter, that programmer — tracked by who has it rather than by how many there are. Register one to start.`,
          actions: [{ label: `Register ${thing}`, primary: true, onClick: () => setRegistering(true) }],
        }}
        pagination={
          data
            ? {
                page,
                totalPages: data.totalPages,
                totalElements: data.totalElements,
                size: data.size,
                onChange: setPage,
              }
            : undefined
        }
        /* ⚠️ **A peek, as the third column** — the same one Inventory opens, so the two screens behave
            alike. The title comes from the row where the row is on this page, and from the panel's own
            fetch where it is not: the scanner resolves an identifier, and the thing it names may be on
            page four. */
        detail={{
          open: Boolean(peek.subject) && !peek.narrow,
          node: peek.subject && (
            <DetailsPanel
              state={peek}
              title={assets.find((asset) => asset.id === peek.subject)?.label ?? capitalised(thing)}
              description={
                assets.find((asset) => asset.id === peek.subject)?.holderLabel ??
                assets.find((asset) => asset.id === peek.subject)?.locationPath ??
                "Where it is, and who has had it."
              }
            >
              <AssetPanel assetId={peek.subject} />
            </DetailsPanel>
          ),
        }}
      >
        <DataTable
          rows={assets}
          rowKey={(asset) => asset.id}
          onRowClick={(asset) => peek.show(asset.id)}
          rowClassName={(asset) =>
            isAlarming(asset, watch.get(asset.id))
              ? "border-l-2 border-l-destructive bg-destructive/5"
              : undefined
          }
          columns={[
            {
              key: "label",
              header: capitalised(thing),
              className: "max-w-72 truncate font-medium",
              cell: (asset) => (
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true">{STATE_GLYPHS[asset.state]}</span>
                  {asset.label}
                </span>
              ),
            },
            {
              key: "where",
              header: "Where it is",
              className: "text-muted-foreground max-w-64 truncate",
              /* ⚠️ Whichever of the two is filled in — a thing is with somebody *or* somewhere. */
              cell: (asset) => asset.holderLabel ?? asset.locationPath ?? "nowhere in particular",
            },
            {
              key: "form",
              header: "Kind",
              className: "text-muted-foreground",
              cell: (asset) => asset.formName,
            },
            {
              key: "reading",
              header: "Reading",
              align: "right",
              cell: (asset) => {
                const summary = watch.get(asset.id)
                return summary?.currentValue
                  ? `${summary.currentValue}${summary.metricUnit ? ` ${summary.metricUnit}` : ""}`
                  : "—"
              },
            },
            {
              key: "standing",
              header: "Standing",
              /* ⚠️ **Both kinds of late land in one column, and they are different facts.** `overdue`
                 is *not brought back*; an alarming watch state is *not serviced* or *reading wrong*.
                 Somebody scanning asks "which of these wants me", not which mechanism said so. */
              cell: (asset) => {
                const summary = watch.get(asset.id)
                const alarming = summary?.state === "OVERDUE" || summary?.state === "OUT_OF_RANGE"
                return (
                  <span className="flex flex-wrap items-center gap-1">
                    {asset.overdue && <Badge variant="destructive">overdue</Badge>}
                    {asset.dueAt && !asset.overdue && (
                      <Badge variant="outline">due {relativeMoment(asset.dueAt)}</Badge>
                    )}
                    {summary && summary.state !== "OK" && (
                      <Badge variant={alarming ? "destructive" : "outline"} title={summary.planName}>
                        {WATCH_WORDS[summary.state]}
                      </Badge>
                    )}
                    {!asset.overdue && !asset.dueAt && (!summary || summary.state === "OK") && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                )
              },
            },
          ]}
        />
      </ListScreen>
      {registering && <RegisterAssetDialog onClose={() => setRegistering(false)} />}
      {scanning && (
        <ScanDialog
          onResolved={(resolution) => {
            setScanning(false)
            // A resolved thing opens the drawer every other route into it opens. A resolved PLACE is
            // deliberately not handled here — it belongs to the locations screen, and inventing a
            // second place view on the assets page is the parallel flow this whole design refuses.
            if (resolution.kind === "asset" && resolution.subjectId) {
              peek.show(resolution.subjectId)
            }
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  )
}
/**
 * The worst thing every rule says about each thing, indexed by thing.
 *
 * ⚠️ **One badge per row, never one per rule.** An excavator with four plans has four answers, and a row
 * carrying all of them is unreadable — `DueState` declares itself in order of concern precisely so a
 * caller can take the highest.
 */
function useWatchStateByAsset(): Map<string, WatchSummary> {
  const { data: rows = [] } = useMaintenanceBoard({})
  return useMemo(() => {
    const worst = new Map<string, WatchSummary>()
    for (const row of rows) {
      const standing = worst.get(row.assetId)
      if (!standing || CONCERN.indexOf(row.answer.state) > CONCERN.indexOf(standing.state)) {
        worst.set(row.assetId, {
          state: row.answer.state,
          planName: row.answer.planName,
          currentValue: row.answer.currentValue,
          metricUnit: row.answer.metricUnit,
        })
      }
    }
    return worst
  }, [rows])
}
/** The backend's own order of concern, so the two never disagree about which answer wins. */
const CONCERN = ["OK", "STALE", "DUE_SOON", "OVERDUE", "OUT_OF_RANGE"] as const
interface WatchSummary {
  state: DueState
  planName: string
  currentValue: string | null
  metricUnit: string | null
}
/**
 * Whether a row wants somebody's attention — either kind of late.
 *
 * ⚠️ **Two different facts, one stripe.** `overdue` is *not brought back*; an alarming watch state is
 * *not serviced* or *reading wrong*. Whoever scans this board is asking "which of these wants me", not
 * which mechanism said so — so the row is marked either way and the column keeps the two words apart.
 */
function isAlarming(asset: Asset, watch: WatchSummary | undefined) {
  return asset.overdue || watch?.state === "OVERDUE" || watch?.state === "OUT_OF_RANGE"
}
/**
 * ⚠️ **Said in the words somebody staffing a store uses**, not in the enum's. `STALE` is the state that
 * exists so *nobody has written a number down* stops looking like *nothing is due*, and calling it
 * "stale" on screen would throw that distinction away again.
 */
const WATCH_WORDS: Record<DueState, string> = {
  OK: "",
  STALE: "no readings",
  DUE_SOON: "service soon",
  OVERDUE: "service overdue",
  OUT_OF_RANGE: "reading out of range",
}
export { STATES as ASSET_STATES, STATE_GLYPHS as ASSET_STATE_GLYPHS }
