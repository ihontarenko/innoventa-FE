import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { agentsApi, type Agent, type AgentOptions, type AgentPayload, type AgentSwitch } from "@/api/agents"

/**
 * Your own agents.
 *
 * ⚠️ **Every write here also invalidates the library's `["ai", "agents"]` list**, which is what the card
 * list on this very screen reads. One product route and one library route answer about the same rows;
 * refreshing only the one that was written is how somebody creates an agent and sees nothing appear.
 */
const AGENT_KEYS = {
  options: ["agents", "options"] as const,
  switch: ["agents", "switch"] as const,
  connection: ["agents", "connection-info"] as const,
}

export function useAgentOptions() {
  return useQuery<AgentOptions>({
    queryKey: AGENT_KEYS.options,
    queryFn: () => agentsApi.getOptions().then((response) => response.data),
    staleTime: 5 * 60_000,
  })
}

export function useAgentsSwitch() {
  return useQuery<AgentSwitch>({
    queryKey: AGENT_KEYS.switch,
    queryFn: () => agentsApi.readSwitch().then((response) => response.data),
  })
}

export function useAgentConnectionInfo() {
  return useQuery({
    queryKey: AGENT_KEYS.connection,
    queryFn: () => agentsApi.connectionInfo().then((response) => response.data),
    staleTime: Infinity,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()

  return useMutation<Agent, unknown, AgentPayload & { name: string }>({
    mutationFn: (payload) => agentsApi.create(payload).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      queryClient.invalidateQueries({ queryKey: ["ai", "agents"] })
    },
  })
}

/**
 * One switch over the lot, for shutting everything down without hunting through a list.
 *
 * ⚠️ Separate from each agent's own switch, and it says so: turning them all off and on again leaves the
 * one you switched off individually still off, which is the whole reason this is a second switch rather
 * than a loop over the first.
 */
export function useSwitchAllAgents() {
  const queryClient = useQueryClient()

  return useMutation<AgentSwitch, unknown, boolean>({
    mutationFn: (enabled) => agentsApi.switchAll(enabled).then((response) => response.data),
    onSuccess: (view) => {
      queryClient.setQueryData(AGENT_KEYS.switch, view)
      queryClient.invalidateQueries({ queryKey: ["ai", "agents"] })
    },
  })
}
