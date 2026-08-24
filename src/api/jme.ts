import { http } from "./http"

/** The mode a `;;;jme` block was actually evaluated in. */
export type JmeMode = "expression" | "template"

export interface JmeExecuteRequest {
  code: string
  variables: Record<string, unknown>
  /** Omitted (or `auto`) lets the server detect it. */
  mode?: JmeMode | "auto"
}

export interface JmeExecuteResponse {
  result: unknown
  mode: JmeMode
}

/**
 * Evaluating a `;;;jme` applet against whatever is currently typed into its inputs.
 *
 * ⚠️ **Two endpoints, and the difference is reachability, not permission.** In-app an applet evaluates
 * against the authenticated endpoint; on a shared page or an inert preview that one cannot be reached at
 * all, so the public one answers. The choice is made once, by the surface — see `innoventaEvaluator`.
 */
export const jmeApi = {
  execute: (request: JmeExecuteRequest) => http.post<JmeExecuteResponse>("/jme/execute", request),

  executePublic: (request: JmeExecuteRequest) => http.post<JmeExecuteResponse>("/public/jme/execute", request),
}
