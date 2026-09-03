import { http } from "./http"

/**
 * What kind of place this is — descriptive, and it drives the glyph.
 *
 * ⚠️ **`SITE` is a building, a branch, a customer's premises: somewhere things *are*, rather than
 * something things are *in*.** It exists so a top-level node can be a place rather than a container, and
 * the difference shows the moment somebody has stock at two addresses.
 */
export type StorageLocationKind = "ROOM" | "CABINET" | "SHELF" | "DRAWER" | "BIN" | "BOX" | "SITE" | "OTHER"

export interface StorageLocation {
  id: string
  parentId: string | null
  name: string
  kind: StorageLocationKind
  notes: string | null
  /** Human-readable ancestry, e.g. `Lab / Cabinet A / Drawer 3`. Built by the server. */
  path: string
  spaceId: string | null
  sortOrder: number
  /** ⚠️ Entries filed **directly** here — not counting what is in the children. */
  itemCount: number
  /** ⚠️ Nested, unlike the folder tree: this one arrives already assembled. */
  children: StorageLocation[]
}

/** Where one entry physically lives. */
export interface EntryLocation {
  entryId: string
  locationId: string
  locationName: string
  path: string
}

export interface LocationItem {
  entryId: string
  label: string
  /** ⚠️ The form's **id** — a record is addressed by its form and its id, and a link built from the name resolves to nothing. */
  formId: string
  formName: string
  /** Where exactly, when the listing reached into nested places. ⚠️ Absent for an item sitting right here. */
  location?: string | null
}

export const storageLocationsApi = {
  tree: () => http.get<StorageLocation[]>("/storage-locations"),

  /**
   * What is filed here — and, with `deep`, in everything inside it too.
   *
   * ⚠️ **Two different questions, and the default is the narrow one.** Asking a cabinet and being shown
   * its drawers is usually what somebody means; it is also what turns "this place is empty" into a
   * wrong conclusion the other way.
   */
  contents: (locationId: string, deep = false) =>
    http.get<LocationItem[]>(`/storage-locations/${locationId}/items`, { params: { deep } }),

  create: (payload: {
    name: string
    kind?: StorageLocationKind
    parentId?: string | null
    notes?: string
    sortOrder?: number
  }) => http.post<StorageLocation>("/storage-locations", payload),

  update: (
    locationId: string,
    payload: Partial<{
      name: string
      kind: StorageLocationKind
      parentId: string | null
      notes: string
      sortOrder: number
    }>,
  ) => http.put<StorageLocation>(`/storage-locations/${locationId}`, payload),

  delete: (locationId: string) => http.delete<void>(`/storage-locations/${locationId}`),

  /** ⚠️ `null` is an answer — the thing exists and is nowhere in particular. */
  whereIs: (entryId: string) => http.get<EntryLocation | null>(`/storage-locations/entries/${entryId}`),

  assign: (entryId: string, locationId: string) =>
    http.put<EntryLocation>(`/storage-locations/entries/${entryId}`, { locationId }),

  unassign: (entryId: string) => http.delete<void>(`/storage-locations/entries/${entryId}`),
}
