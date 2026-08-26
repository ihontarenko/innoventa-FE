import { http } from "./http"

/**
 * Your own agents — the product's half, beside the library's.
 *
 * ⚠️ **No `update` and no `delete`, and the routes behind them are gone from the backend too.**
 * `PATCH /api/agents/{id}` was a SECOND way to grant an agent something, beside the shared
 * `PUT /jmouse/ai/api/my-agents/{id}/grants` that both products answer — two editors over one set of rows is
 * how two screens come to disagree about what an agent holds. Use `aiApi.replaceAgentGrants` and
 * `aiApi.discardAgent`.
 */

export interface AgentSpace {
  id: string
  name: string
}

export interface AgentRoleTemplate {
  name: string
  label: string
  description: string | null
}

export interface Agent {
  id: string
  name: string
  enabled: boolean
  roleNames: string[]
  permissionNames: string[]
  grantedPermissionNames: string[]
  spaces: AgentSpace[]
  createdAt: string | null
  lastActiveAt: string | null
}

export interface AgentOptions {
  roleTemplates: AgentRoleTemplate[]
  grantablePermissions: string[]
  availableSpaces: AgentSpace[]
}

/** Where the account-wide switch stands, and how many agents it covers. */
export interface AgentSwitch {
  agentsEnabled: boolean
  agentCount: number
}

export interface AgentPayload {
  name?: string
  roleNames?: string[]
  permissionNames?: string[]
  spaceIds?: string[]
  enabled?: boolean
}

export const agentsApi = {
  list: () => http.get<Agent[]>("/agents"),

  getOptions: () => http.get<AgentOptions>("/agents/options"),

  create: (payload: AgentPayload & { name: string }) => http.post<Agent>("/agents", payload),

  /** ⚠️ Where to point a protocol client — answered by the server, never guessed from the origin. */
  connectionInfo: () => http.get<{ serverUrl: string }>("/agents/connection-info"),

  readSwitch: () => http.get<AgentSwitch>("/agents/switch"),

  /** One switch over every agent you own. Each keeps its own setting for when it goes back on. */
  switchAll: (enabled: boolean) => http.patch<AgentSwitch>("/agents/switch", { enabled }),
}
