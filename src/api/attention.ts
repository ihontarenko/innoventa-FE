import { http } from "./http"

/**
 * One thing that wants somebody this morning.
 *
 * ⚠️ **Deliberately flat and deliberately dull.** Everything specific — that this is a drill, that it is
 * overdue by three days — has already happened by the time one of these exists. What travels is a
 * sentence, a weight and a way to get there, which is what lets the screen render a source it has never
 * heard of.
 */
export interface AttentionItem {
  /** What it is about, in the publisher's own vocabulary. The screen groups and links by it. */
  subjectKind: string
  subjectId: string
  title: string
  detail: string
  /** Higher is more urgent, on a scale shared by every publisher. */
  weight: number
  actionKey: string | null
  actionLabel: string | null
}

export interface AttentionGroup {
  key: string
  label: string
  items: AttentionItem[]
}

/**
 * ⚠️ **A group the reader may not see never arrives**, so a count can never disagree with the list under
 * it — the filtering happens before the counting, on the server.
 */
export const attentionApi = {
  board: () => http.get<AttentionGroup[]>("/attention"),
}
