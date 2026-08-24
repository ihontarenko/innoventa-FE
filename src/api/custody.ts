import { http } from "./http"
import type { Page } from "./forms"

export type AssetState = "AVAILABLE" | "ISSUED" | "IN_SERVICE" | "WRITTEN_OFF"

/**
 * One thing, as the board shows it.
 *
 * ⚠️ **`holder*` and `location*` are exclusive: exactly one pair is filled in.** A possession is by
 * somebody **or** somewhere and never both — that is the whole model. A written-off thing keeps whichever
 * it had last, which is why neither is typed as always-present.
 */
export interface Asset {
  id: string
  label: string
  state: AssetState
  formEntryId: string
  formId: string
  formName: string
  holderId: string | null
  holderLabel: string | null
  locationId: string | null
  locationPath: string | null
  issuedAt: string | null
  dueAt: string | null
  overdue: boolean
  createdAt: string
  updatedAt: string
}

/** One period of possession. ⚠️ `returnedAt: null` means it is the *current* one. */
export interface CustodyMovement {
  id: string
  holderId: string | null
  holderLabel: string | null
  locationId: string | null
  locationPath: string | null
  conditionCode: string | null
  issuedAt: string
  dueAt: string | null
  returnedAt: string | null
  overdue: boolean
  note: string | null
}

export interface AssetDetail {
  asset: Asset
  history: CustodyMovement[]
}

/** A condition a thing can come back in, from the workspace's own catalogue. */
export interface CustodyCondition {
  code: string
  label: string
  icon: string | null
  sortOrder: number
  /** ⚠️ The one bit of behaviour: returning in this condition takes the thing **out of circulation**. */
  triggersService: boolean
}

export interface AssetFilter {
  state?: AssetState
  formId?: string
  holderEntryId?: string
  /** ⚠️ Matched together with everything kept **beneath** it — a cabinet finds its drawers' contents. */
  locationId?: string
  overdue?: boolean
  /** ⚠️ Matched against everything written about the thing, not only what labels it. */
  query?: string
}

export interface PickableForm {
  id: string
  name: string
  icon: string | null
}

/** Somebody — or something — that can be holding a thing. */
export interface Holder {
  entryId: string
  label: string
  formName: string
  /** How many things this holder has out **right now** — open possessions only. */
  holding: number
  overdue: number
}

/**
 * Custody — a thing, where it is, and who has it.
 *
 * ⚠️ **Every route here is scoped by the `X-Space-Id` header the client already sends, so nothing below
 * names a workspace.** That is deliberate on the backend too: a workspace named separately in the query
 * string would let a request be admitted on the strength of one workspace and answered out of another.
 */
export const custodyApi = {
  /**
   * ⚠️ **`overdue` is sent only when true.** Axios drops `undefined`, and the backend reads an absent
   * filter as "do not narrow" — `overdue=false` would be a third state nobody means.
   *
   * ⚠️ `jmq:filter` and `jmq:order` are the OTHER way of narrowing, and they compose with the controls
   * above rather than replacing them: the first is a set of switches the query already knows how to ask,
   * the second is an expression over the equipment vocabulary. The `jmq:` prefix keeps a plain column
   * sort and an expression sort from ever being confused.
   */
  assets: (
    page = 0,
    size = 25,
    filter: AssetFilter = {},
    jmq: { filter?: string | null; order?: string | null } = {},
  ) =>
    http.get<Page<Asset>>("/custody/assets", {
      params: {
        page,
        size,
        state: filter.state,
        formId: filter.formId,
        holderEntryId: filter.holderEntryId,
        locationId: filter.locationId,
        query: filter.query,
        overdue: filter.overdue ? true : undefined,
        "jmq:filter": jmq.filter || undefined,
        "jmq:order": jmq.order || undefined,
      },
    }),

  /** One thing, with everywhere it has been. */
  asset: (assetId: string) => http.get<AssetDetail>(`/custody/assets/${assetId}`),

  /** Registers a thing and puts it where it starts out. */
  register: (payload: {
    formId?: string
    fieldValues?: Record<string, string>
    formEntryId?: string
    locationId: string
    note?: string
  }) => http.post<AssetDetail>("/custody/assets", payload),

  issue: (assetId: string, payload: { holderEntryId: string; dueAt?: string; note?: string }) =>
    http.post<AssetDetail>(`/custody/assets/${assetId}/issue`, payload),

  returnToPlace: (assetId: string, payload: { locationId: string; conditionCode?: string; note?: string }) =>
    http.post<AssetDetail>(`/custody/assets/${assetId}/return`, payload),

  /** ⚠️ Straight from one holder to the next, without a return in between — which is what really happens. */
  transfer: (
    assetId: string,
    payload: { holderEntryId?: string; locationId?: string; dueAt?: string; note?: string },
  ) => http.post<AssetDetail>(`/custody/assets/${assetId}/transfer`, payload),

  /** ⚠️ A note is required: a thing leaving the books for good is the one movement that must say why. */
  writeOff: (assetId: string, payload: { note: string }) =>
    http.post<AssetDetail>(`/custody/assets/${assetId}/write-off`, payload),

  assetForms: () => http.get<PickableForm[]>("/custody/asset-forms"),

  holderForms: () => http.get<PickableForm[]>("/custody/holder-forms"),

  holders: () => http.get<Holder[]>("/custody/holders"),

  conditions: () => http.get<CustodyCondition[]>("/custody/conditions"),

  /**
   * ⚠️ **The camera and the typed field go through this same call.** A second route for "I typed it"
   * would be a second ladder, and the two would drift the day somebody added a rung.
   */
  scan: (code: string) => http.get<ScanResolution>("/custody/scan", { params: { code } }),
}

/** What one thing on the other end of a code is called. */
export interface ScanCandidate {
  subjectId: string
  label: string
}

/**
 * What a scanned or typed code points at.
 *
 * ⚠️ **`candidates` is a real answer, not a failure.** An inventory number is a field value — editable,
 * duplicable, sometimes blank — so a match is a search that sometimes finds two, and the product hands
 * both back rather than deciding which drill somebody meant.
 */
export interface ScanResolution {
  kind: "asset" | "location" | "candidates" | "none"
  subjectId: string | null
  label: string | null
  candidates: ScanCandidate[]
}
