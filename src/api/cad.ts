import { http } from "./http"

/**
 * One end of a drawing's attachment, seen from the other end.
 *
 * ⚠️ **`linkedEntry*` is always the far side, whichever side you asked from.** Asked of a part it is the
 * footprint; asked of the footprint it is the part. That is not a convenience — the table is stored once
 * and read symmetrically, so there is only ever one row and it has no near side of its own.
 */
export interface CadAttachment {
  /** The link's own id — what a detach is addressed by. */
  id: string
  linkedEntryId: string
  linkedFormId: string
  linkedFormName: string
  linkedEntryTitle: string
  label: string | null
  /**
   * ⚠️ **Whether the entry being looked at POINTS AT the far end**, rather than being pointed at.
   *
   * The table stores each pair once and is read symmetrically, so nothing else in this answer can tell
   * the two ends apart — and the obvious substitute, *what kind of thing is at the far end*, fails
   * exactly when both ends are the same kind. A footprint and the 3D body it places are that case, and
   * without this the body claims to use the footprint.
   */
  outgoing: boolean
  createdAt: string
}

export const cadApi = {
  /** What this entry is drawn as — or, asked of a drawing, everything that uses it. */
  attachments: (entryId: string) => http.get<CadAttachment[]>(`/entries/${entryId}/cad`),

  attach: (entryId: string, drawingEntryId: string) =>
    http.post<CadAttachment>(`/entries/${entryId}/cad`, { drawingEntryId }),

  detach: (linkId: string) => http.delete<void>(`/entries/cad/${linkId}`),
}
