import { http } from "./http"
import type { Page } from "./forms"
import type { FormEntry } from "@/types"

/**
 * What a price came to, in the currency it was written in.
 *
 * ⚠️ **`currency` is null where a price was stored without a unit**, and that is kept apart rather than
 * folded in: "12" and "12 UAH" are not the same claim, and a total that silently mixes them is a figure
 * somebody will quote.
 */
export interface StockValue {
  currency: string | null
  amount: number
}

/**
 * Why a figure is sitting outside the converted total.
 *
 * ⚠️ **Three cases with three different fixes**, which is why they are not one "unconvertible" bucket.
 * `NO_CURRENCY` is the type's Catalogue pane (its price field is a plain number and cannot hold a unit);
 * `NOT_A_CURRENCY` is somebody's typing; `NO_RATE` is the Exchange rates screen.
 */
export type UnconvertedReason = "NO_CURRENCY" | "NOT_A_CURRENCY" | "NO_RATE"

export interface UnconvertedValue {
  /** What the price field carried. ⚠️ Absent — not `null` — where it carried nothing at all. */
  unit?: string
  amount: number
  reason: UnconvertedReason
}

export interface StockSummaryByType {
  formId: string
  formName: string
  icon: string | null
  rows: number
  units: number
  /** How many rows actually carried a quantity, and a price. See {@link StockSummary}. */
  countedRows: number
  pricedRows: number
  value: StockValue[]
  /** This type's holdings in the base currency. ⚠️ Absent where none of it could be converted. */
  approximateValue?: StockValue
}

/**
 * ⚠️ **`countedRows` and `pricedRows` are what make a zero explainable.** *Nothing is priced*, *nothing
 * says how many* and *everything is genuinely empty* all total nothing, and the first two are
 * configuration somebody can fix on the type's own Stock and Catalogue panes. A strip that only said "0"
 * would send them to look at their data instead.
 */
export interface StockSummary {
  rows: number
  units: number
  /** The EXACT figures, one per currency — unaddable, and the only precise answer there is. */
  value: StockValue[]
  /**
   * The same holdings as one number, in the installation's base currency.
   *
   * ⚠️ **Absent — not zero — where nothing could be converted.** Zero is a real claim (*these are worth
   * nothing*); this is the different claim *nothing here could be counted*, and the two must not render
   * alike. ⚠️ And absent means `undefined`, never `null`: nullable backend fields do not serialise, so
   * `=== null` is silently always false here.
   */
  approximateValue?: StockValue
  /** What did not join that figure, and why. Empty when everything converted. */
  unconverted: UnconvertedValue[]
  /**
   * When the rates behind the conversion last moved. ⚠️ Absent if they never have.
   *
   * A converted total on three-month-old rates is as misleading as no total, and this is the only thing
   * that tells them apart — so it is shown beside the figure rather than kept for a details pane.
   */
  ratesUpdatedAt?: string
  countedRows: number
  pricedRows: number
  /**
   * How many boxes hold less than the minimum written on them, and how many hold nothing at all.
   *
   * ⚠️ **Boxes, not parts** — a minimum is written per box, so the same component can be low in one
   * place and abundant in another. `stockApi.low()` carries what the workspace holds altogether beside
   * each one, which is what stops "3 low" being read as "we are out of three things".
   */
  lowPositions: number
  emptyPositions: number
  byType: StockSummaryByType[]
}

/**
 * A box holding less than the minimum written on it.
 *
 * ⚠️ **`heldAcrossWorkspace` and `placeCount` are the point, not decoration.** A bench drawer running
 * low on a component the storage box holds nine hundred of is a walk, not an order — and without those
 * two figures beside the shortfall the row reads as a reason to buy more.
 */
export interface LowPosition {
  entryId: string
  partId: string | null
  partLabel: string | null
  held: number
  minimum: number
  shortfall: number
  locationId: string | null
  locationPath: string | null
  heldAcrossWorkspace: number
  placeCount: number
}

/**
 * Why a quantity moved.
 *
 * ⚠️ **A movement always has one**, and it is not decoration: "there are twelve fewer" and "twelve went
 * to the charger project" are the same arithmetic and different facts, and only the second can be
 * looked up six months later.
 */
export type MovementReason = "RECEIPT" | "ISSUE" | "WRITE_OFF" | "COUNT" | "EDIT"

/** How the change arrived — provenance, never permission. */
export type MovementSource = "WEB" | "STATION" | "LOOKUP" | "IMPORT" | "MCP"

/**
 * The half of {@link MovementSource} a browser may claim for itself.
 *
 * ⚠️ **Narrower than `MovementSource` on purpose, and the backend is narrower in the same way.** The
 * other three are written by callers inside the server — an import, a distributor lookup, an agent over
 * the protocol — and a request that could name one of those would let this interface sign a movement as
 * an agent. The backend's `ClientSurface` cannot spell them either, so sending one is a 400.
 */
export type ClientSurface = "WEB" | "STATION"

/**
 * One adjustment, as asked for.
 *
 * ⚠️ **`delta` is signed and the sign is not inferred.** An issue of twenty is `-20`. A server that
 * decided the sign from the reason would double-negate a client that already sent one, and twenty would
 * appear on a shelf somebody had just emptied. The refusal names the sign the reason takes.
 */
export interface AdjustRequest {
  delta: number
  reason: MovementReason
  projectId?: string
  stocktakeId?: string
  note?: string
  /**
   * Which of this interface's own screens made the change. Absent means `WEB`.
   *
   * ⚠️ **A self-report, and the journal reads it as one.** The station is this same application
   * installed to a home screen, so nothing about the request distinguishes it — this is the interface
   * saying so, worth what `reason` and `note` beside it are worth.
   */
  surface?: ClientSurface
}

export interface Movement {
  id: string
  entryId: string
  entryLabel: string
  delta: number
  reason: MovementReason
  projectId: string | null
  stocktakeId: string | null
  note: string | null
  source: MovementSource
  byUserId: string | null
  byUserName: string | null
  occurredAt: string
}

export interface MovementFilter {
  reason?: MovementReason
  projectId?: string
  stocktakeId?: string
  entryId?: string
  partId?: string
  locationId?: string
  /** A window back from now, in days. ⚠️ Absent means every movement there is. */
  days?: number
}

/** One place a part sits. */
export interface PartPosition {
  entryId: string
  /** ⚠️ `null` where nobody has counted it, which is not the same as zero. */
  quantity: number | null
  locationId: string | null
  locationPath: string | null
}

/** How much of one part is held, and where. */
export interface PartStock {
  partId: string
  totalQuantity: number
  positionCount: number
  positions: PartPosition[]
}

/** A part and its total, without the places — what a listing needs for a whole page at once. */
export interface PartTotal {
  partId: string
  totalQuantity: number
  positionCount: number
}

/**
 * What this workspace is holding, counted by the database.
 *
 * ⚠️ **The workspace is NOT a parameter.** The backend takes it from the active-space context, because
 * the module gate reads that context — a workspace named in the query string could admit a request on
 * the strength of one workspace and answer it out of another. `X-Space-Id` on the request is the whole
 * of the addressing.
 */
export const stockApi = {
  /**
   * ⚠️ **And the purpose is not a parameter either, any more.** It was one while a heap of resistors was
   * an entry of the Resistor form and a workspace could sensibly be asked to sum either its stock or its
   * catalogue. A part carries no quantity now and a position carries no description, so "what do I hold,
   * per component type" is the only sum there is — and the parts screen and the inventory screen both
   * want that same one.
   */
  summary: () => http.get<StockSummary>("/stock/summary"),

  /** Every box under its own minimum, deepest shortfall first. */
  low: () => http.get<LowPosition[]>("/stock/low"),

  /**
   * The inventory listing, narrowed by things only stock knows.
   *
   * ⚠️ **Not the entries listing with a flag.** Every position in a workspace is an entry of one form,
   * so the ordinary type rail narrows nothing — "the diodes" is a question about the form of the
   * entry's *part*, two hops away. The rows come back in the same shape the entries route uses.
   *
   * ⚠️ **And its search finds a part number, which the entries search cannot** — a position stores its
   * part as an identifier, so typing `SS34` into the ordinary search matches nothing at all.
   */
  positions: (
    filter: {
      partFormId?: string
      partId?: string
      low?: boolean
      locationId?: string
      query?: string
    },
    page = 0,
    size = 25,
  ) => http.get<Page<FormEntry>>("/stock/positions", { params: { ...filter, page, size } }),

  /**
   * Move a position's quantity by recording why it moved.
   *
   * ⚠️ **The only way a quantity changes.** Saving the entry with a different number is refused by the
   * backend with a 409 that says so — the number on a shelf is the sum of everything that happened to
   * it, and typing over a total erases the history that explains it.
   */
  adjust: (entryId: string, request: AdjustRequest) =>
    http.post<Movement>(`/stock/positions/${entryId}/adjust`, request),

  /** One position's history, newest first. */
  movementsOf: (entryId: string, page = 0, size = 25) =>
    http.get<Page<Movement>>(`/stock/positions/${entryId}/movements`, { params: { page, size } }),

  /** The workspace journal, newest first, narrowed by whatever is named. */
  movements: (filter: MovementFilter = {}, page = 0, size = 50) =>
    http.get<Page<Movement>>("/stock/movements", { params: { ...filter, page, size } }),

  /** How much of one part is held, and in which places. */
  byPart: (partId: string) => http.get<PartStock>("/stock/by-part", { params: { partId } }),

  /**
   * ⚠️ **On-hand totals for a whole page of parts in one call.** The per-part version of this is the
   * one that works perfectly until the listing has two hundred rows on it.
   */
  totals: (partIds: string[]) =>
    http.get<Record<string, PartTotal>>("/stock/totals", { params: { partId: partIds } }),
}
