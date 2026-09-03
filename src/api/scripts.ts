import { http } from "./http"
import type { CompletionCatalogue } from "@jmouse/codemirror/completion"

/**
 * The script editor's half of `/admin/scripts`.
 *
 * ## ⚠️ The browser never decides whether a script is valid
 *
 * `rehearse` runs the real parser and the real binder on the server and answers with their own
 * sentence, verbatim. The CodeMirror grammar in `@jmouse/codemirror` colours and the catalogue source
 * offers — neither judges. A second grammar in the browser agrees with the first for about a month,
 * and the first thing it gets wrong is the thing somebody is halfway through typing.
 *
 * ## ⚠️ The catalogue is fetched apart from the document, on purpose
 *
 * It feeds completion and nothing else, so the editor has to open, save and revert without it. Asking
 * for both in one call would make a suggestion list the reason somebody cannot edit a rule.
 */

/** Whether a stored document still binds against what this build declares. */
export type ScriptBindState = "BOUND" | "REFUSED"

/**
 * Which stage refused, because the two have different next moves: `PARSE` is a typo, `BIND` usually
 * means the document is fine and the build changed underneath it.
 */
export type ScriptProblemStage = "PARSE" | "BIND"

/** What is wrong and where. `line` is 0 where the failure has no position. */
export interface ScriptProblem {
  stage: ScriptProblemStage
  line: number
  column: number
  message: string
}

/**
 * What a document asks to be allowed.
 *
 * ⚠️ `null` means *did not ask* — the installation's ceiling is used — never *unlimited*. The editor
 * shows an empty box rather than a zero for exactly that reason.
 */
export interface ScriptBudget {
  steps: number | null
  loopIterations: number | null
  recursionDepth: number | null
  deadlineMillis: number | null
}

/**
 * One row of the rail.
 *
 * ⚠️ `bindProblem` is here rather than only on the detail, so a document that stopped binding at the
 * last boot is visible without opening it. A fault you have to click to discover is one nobody does.
 */
export interface ScriptDocumentSummary {
  id: string
  name: string
  description: string | null
  enabled: boolean
  sortOrder: number
  version: number
  bindState: ScriptBindState
  bindProblem: string | null
  updatedAt: string
}

export interface ScriptDocumentDetail extends ScriptDocumentSummary {
  source: string
  budget: ScriptBudget
  createdAt: string
}

/**
 * A save — the whole of a document, never part of one.
 *
 * ⚠️ Every field is applied. Read the document, change what you mean to change, send all of it back.
 */
export interface ScriptDocumentRequest {
  name: string
  description: string | null
  source: string
  enabled: boolean
  sortOrder: number
  budget: ScriptBudget | null
  note: string | null
}

export interface ScriptRehearsal {
  valid: boolean
  problem: ScriptProblem | null
}

export interface ScriptRevision {
  version: number
  note: string | null
  byUserId: string | null
  recordedAt: string
}

/**
 * How one document has behaved since the application started.
 *
 * ⚠️ In memory on the server, so a restart empties it. It answers *is my rule firing right now*, which
 * is the question somebody asks while watching — never *what did it do last Tuesday*.
 */
export interface ScriptRun {
  document: string
  runs: number
  /** ⚠️ A failure takes the entry write with it — that is the contract, not a bug. */
  failures: number
  lastRunAt: string | null
  lastEvent: string | null
  lastFailure: string | null
}

/** One thing a rule said through `@log`, or one failure the runtime recorded. */
export interface ScriptLine {
  at: string
  level: "INFO" | "WARN" | "ERROR"
  document: string
  text: string
}

export interface ScriptActivity {
  documents: ScriptRun[]
  lines: ScriptLine[]
}

export interface ScriptHistory {
  documentId: string
  revisions: ScriptRevision[]
}

/**
 * ⚠️ **Every call names the workspace, and none of them relies on the ambient header.**
 *
 * This screen lives in the installation menu, where the interface is in no workspace and sends no
 * `X-Space-Id` — the first version of this module assumed otherwise and every request was refused. The
 * parameter is also the better shape: an installation-wide permission legitimately edits any
 * workspace's scripts, and a script runs on every write in the one it names, so saying which out loud
 * is worth the extra argument.
 */
export const scriptsApi = {
  list: (spaceId: string) =>
    http.get<ScriptDocumentSummary[]>("/scripts", { params: { spaceId } }),

  read: (spaceId: string, documentId: string) =>
    http.get<ScriptDocumentDetail>(`/scripts/${documentId}`, { params: { spaceId } }),

  history: (spaceId: string, documentId: string) =>
    http.get<ScriptHistory>(`/scripts/${documentId}/revisions`, { params: { spaceId } }),

  /**
   * ⚠️ Installation-wide, and its failure costs suggestions rather than the ability to edit — callers
   * must tolerate a rejection. What a script may *reach* is decided by the beans this build ships, so
   * it does not vary by workspace and deliberately takes no `spaceId`.
   */
  catalogue: () => http.get<CompletionCatalogue>("/scripts/catalogue"),

  /** ⚠️ Polled while the editor is open — it is how somebody sees their rule fire. */
  activity: (spaceId: string) =>
    http.get<ScriptActivity>("/scripts/activity", { params: { spaceId } }),

  rehearse: (name: string, source: string) =>
    http.post<ScriptRehearsal>("/scripts/rehearse", { name, source }),

  create: (spaceId: string, request: ScriptDocumentRequest) =>
    http.post<ScriptDocumentDetail>("/scripts", request, { params: { spaceId } }),

  revise: (spaceId: string, documentId: string, request: ScriptDocumentRequest) =>
    http.put<ScriptDocumentDetail>(`/scripts/${documentId}`, request, { params: { spaceId } }),

  revert: (spaceId: string, documentId: string, version: number) =>
    http.post<ScriptDocumentDetail>(
      `/scripts/${documentId}/revisions/${version}/revert`, {}, { params: { spaceId } }),

  remove: (spaceId: string, documentId: string) =>
    http.delete<void>(`/scripts/${documentId}`, { params: { spaceId } }),
}
