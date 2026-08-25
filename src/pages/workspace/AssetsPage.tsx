import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  cn,
  type FilterItem,
  FilterPanel,
  Input,
  Row,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { ToggleChip } from "@/components/ToggleChip"
import { ViewBar } from "@/components/ViewBar"
import { AssetDrawer } from "@/components/custody/AssetDrawer"
import { RegisterAssetDialog } from "@/components/custody/RegisterAssetDialog"
import { ScanDialog } from "@/components/custody/ScanDialog"
import { useAssetForms, useAssets } from "@/hooks/useCustody"
import { QueryPanel, type AppliedQuery } from "@jmouse/query"
import { assetsOf } from "@/components/query/subjects"
import { QUERY_LABELS } from "@/components/query/labels"
import { useMaintenanceBoard } from "@/hooks/useMonitoring"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { useViewFromAddress } from "@/hooks/useViewFromAddress"
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
  const [page, setPage] = useState(0)
  const [state, setState] = useState<AssetState | undefined>(undefined)
  const [formId, setFormId] = useState<string | undefined>(undefined)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [typed, setTyped] = useState("")
  const [openAssetId, setOpenAssetId] = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [jmq, setJmq] = useState<AppliedQuery>({})
  const [composing, setComposing] = useState(false)

  // ⚠️ Debounced because this one is a *server* filter — a request per keystroke against a paged board.
  const query = useDebouncedValue(typed.trim(), 300)

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
      <PageHeader
        title={capitalised(things)}
        description={`${data?.totalElements ?? 0} ${things} — where they are and who has them`}
        actions={
          <>
            <ToggleChip active={composing} onClick={() => setComposing((previous) => !previous)}>
              Filter
            </ToggleChip>

            <ToggleChip
              active={overdueOnly}
              title="Only things that were due back already"
              onClick={() => {
                setOverdueOnly((previous) => !previous)
                setPage(0)
                setActiveViewId(null)
              }}
            >
              Overdue
            </ToggleChip>

            <Input
              size="sm"
              className="w-64"
              value={typed}
              placeholder={`Search everything about a ${thing}…`}
              onChange={(event) => {
                setTyped(event.target.value)
                setPage(0)
                setActiveViewId(null)
              }}
            />

            {/* ⚠️ Batch is by FILTER, not by selection — the filters already on this screen answer
                "which forty", so this is one button rather than forty checkboxes. It draws itself only
                where a design exists for the chosen form, so it is absent rather than a dead end. */}
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

            <Button size="sm" onClick={() => setRegistering(true)}>
              Register a {thing}
            </Button>
          </>
        }
      />

      {/*
        ⚠️ Below the header rather than in a drawer: a filter somebody is composing and the rows it will
        narrow belong on one screen. A panel that covered the list would make every adjustment a guess.

        ⚠️ The form is passed as it is CHOSEN, so choosing one widens the vocabulary to that form's
        fields and choosing none leaves the asset's own facts — which is the useful answer here rather
        than a degraded one, because equipment spans several forms.
      */}
      {composing && (
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
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="State"
          items={filterItems}
          activeKey={activeKey}
          onSelect={choose}
          allLabel="Everything"
          allIcon="☰"
          allCount={data?.totalElements}
          searchable={filterItems.length > 8}
        />

        <div className="flex min-w-0 flex-col gap-3">
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

          {isLoading && assets.length === 0 ? (
            <Skeleton className="h-64 w-full" />
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                🧰
              </span>
              <span className="text-sm font-medium">No {things} yet</span>
              <span className="max-w-md text-xs text-muted-foreground">
                An asset is a *particular* thing — this meter, that programmer — tracked by who has it
                rather than by how many there are. Register one to start.
              </span>
            </div>
          ) : (
            <>
              <RowList>
                {assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    watch={watch.get(asset.id)}
                    onOpen={() => setOpenAssetId(asset.id)}
                  />
                ))}
              </RowList>

              {data && data.totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={data.totalPages}
                  totalElements={data.totalElements}
                  size={data.size}
                  onChange={setPage}
                />
              )}
            </>
          )}
        </div>
      </div>

      {openAssetId && <AssetDrawer assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}

      {registering && <RegisterAssetDialog onClose={() => setRegistering(false)} />}

      {scanning && (
        <ScanDialog
          onResolved={(resolution) => {
            setScanning(false)

            // A resolved thing opens the drawer every other route into it opens. A resolved PLACE is
            // deliberately not handled here — it belongs to the locations screen, and inventing a
            // second place view on the assets page is the parallel flow this whole design refuses.
            if (resolution.kind === "asset" && resolution.subjectId) {
              setOpenAssetId(resolution.subjectId)
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

function AssetRow({
  asset,
  watch,
  onOpen,
}: {
  asset: Asset
  watch: WatchSummary | undefined
  onOpen: () => void
}) {
  // ⚠️ Both kinds of late paint the row, and they are different facts: `overdue` is *not brought back*,
  // an alarming watch state is *not serviced* or *reading wrong*. One stripe either way, because what
  // somebody is scanning for is "which of these wants me", not which mechanism said so.
  const alarming = watch?.state === "OVERDUE" || watch?.state === "OUT_OF_RANGE"

  return (
    <Row
      onOpen={onOpen}
      className={cn((asset.overdue || alarming) && "border-l-2 border-l-destructive bg-destructive/5")}
      leading={<span aria-hidden="true">{STATE_GLYPHS[asset.state]}</span>}
      trailing={
        <>
          {asset.overdue && <Badge variant="destructive">overdue</Badge>}
          {asset.dueAt && !asset.overdue && (
            <Badge variant="outline">due {relativeMoment(asset.dueAt)}</Badge>
          )}
          {watch && watch.state !== "OK" && (
            <Badge variant={alarming ? "destructive" : "outline"} title={watch.planName}>
              {WATCH_WORDS[watch.state]}
            </Badge>
          )}
          <Badge variant="secondary">{asset.formName}</Badge>
        </>
      }
    >
      <RowTitle>{asset.label}</RowTitle>
      {/* ⚠️ Whichever of the two is filled in — a thing is with somebody *or* somewhere, never both. */}
      <RowMeta>
        {asset.holderLabel ?? asset.locationPath ?? "nowhere in particular"}
        {watch?.currentValue
          ? ` · ${watch.currentValue}${watch.metricUnit ? ` ${watch.metricUnit}` : ""}`
          : ""}
      </RowMeta>
    </Row>
  )
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
