import { http } from "./http"

/**
 * A filter somebody named.
 *
 * ⚠️ **`filter` is a JSON string, and the backend never looks inside it.** The screen that wrote it is
 * the screen that reads it — so a board gaining a chip costs a line in that board rather than a column,
 * a DTO field and a migration. `section` is what makes a view applicable at all: an *overdue* saved on
 * the maintenance board has no meaning on the people list.
 */
export interface SavedView {
  id: string
  name: string
  section: string
  filter: string
  pinned: boolean
  sortOrder: number
}

export const viewsApi = {
  mine: (section?: string) => http.get<SavedView[]>("/views", { params: section ? { section } : {} }),

  save: (payload: { name: string; section: string; filter: string; pinned?: boolean }) =>
    http.post<SavedView>("/views", payload),

  pin: (viewId: string, pinned: boolean) =>
    http.put<SavedView>(`/views/${viewId}/pinned`, null, { params: { pinned } }),

  forget: (viewId: string) => http.delete<void>(`/views/${viewId}`),
}
