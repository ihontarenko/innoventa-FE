import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/api/ai";
import type {
    AgentAuthority, AgentConnection, AgentPlacement, AgentSurface, AgentView,
    AiOverview, AiPreference, AiPreferenceDraft,
    ProviderConfiguration, ProviderConfigurations, PublishedAction, ToolCall,
    UpsertProviderConfiguration, UsageTotal,
} from "@/api/ai";

/**
 * The AI administration screen's server state.
 *
 * <p>Every write invalidates **both** the configuration list and the overview, and that is not
 * belt-and-braces: the overview reports what the settings source actually resolved, which is a
 * different question from what the rows say. Activating one is precisely the moment those two answers
 * change together, and a screen showing the new row beside the old "in force" line would be showing
 * the one thing this page exists to tell them apart about.
 *
 * <p>The assistant's own availability is invalidated too, so the chat screen stops offering — or
 * starts offering — a box without needing a reload.
 */

const OVERVIEW  = ['ai', 'overview'];
const SETTINGS  = ['ai', 'configurations'];
const ASSISTANT = ['assistant', 'availability'];

export function useAiOverview() {
    return useQuery<AiOverview>({
        queryKey: OVERVIEW,
        queryFn:  () => aiApi.overview().then((response) => response.data),
    });
}

export function usePublishedActions() {
    return useQuery<PublishedAction[]>({
        queryKey: ['ai', 'actions'],
        // The catalogue is fixed at startup — it cannot change while somebody is looking at it.
        staleTime: Infinity,
        queryFn:  () => aiApi.actions().then((response) => response.data),
    });
}

/**
 * ⚠️ No `action` here. Narrowing the trail to one action is a route of its own in the library
 * (`aiApi.callsOf`), and accepting the parameter on this one would have been accepted by the server
 * and silently ignored — a filter that appears to work and returns everything.
 */
export function useToolCalls(parameters: { caller?: string; limit?: number } = {}) {
    return useQuery<ToolCall[]>({
        queryKey: ['ai', 'calls', parameters],
        queryFn:  () => aiApi.calls(parameters).then((response) => response.data),
    });
}

export function useUsageTotals() {
    return useQuery<UsageTotal[]>({
        queryKey: ['ai', 'usage'],
        queryFn:  () => aiApi.usage().then((response) => response.data),
    });
}

export function useProviderConfigurations() {
    return useQuery<ProviderConfigurations>({
        queryKey: SETTINGS,
        queryFn:  () => aiApi.configurations().then((response) => response.data),
    });
}

export function useCreateProviderConfiguration() {
    return useProviderMutation((payload: UpsertProviderConfiguration) =>
        aiApi.create(payload).then((response) => response.data));
}

export function useUpdateProviderConfiguration() {
    return useProviderMutation(({ id, ...payload }: UpsertProviderConfiguration & { id: string }) =>
        aiApi.update(id, payload).then((response) => response.data));
}

export function useActivateProviderConfiguration() {
    return useProviderMutation((id: string) => aiApi.activate(id).then((response) => response.data));
}

export function useDeactivateProviderConfiguration() {
    return useProviderMutation((id: string) => aiApi.deactivate(id).then((response) => response.data));
}

export function useDeleteProviderConfiguration() {
    return useProviderMutation((id: string) => aiApi.delete(id).then(() => undefined));
}

// ── Preferences ───────────────────────────────────────────────────────────────

const PREFERENCES = ['ai', 'preferences'];

/**
 * What the assistant is told, and whatever else the backend declares beside it.
 *
 * <p>⚠️ **Not invalidated by a provider write and not invalidating one.** They are separate rows
 * answering separate questions — which model, and what it is told — and folding them into one cache
 * would refetch a page of prose every time somebody corrected a token ceiling.
 */
export function useAiPreferences() {
    return useQuery<AiPreference[]>({
        queryKey: PREFERENCES,
        queryFn:  () => aiApi.preferences().then((response) => response.data),
    });
}

export function useAddAiPreferenceValue() {
    return usePreferenceMutation(({ name, ...draft }: AiPreferenceDraft & { name: string }) =>
        aiApi.addPreferenceValue(name, draft).then((response) => response.data));
}

export function useChangeAiPreferenceValue() {
    return usePreferenceMutation(({ id, ...draft }: AiPreferenceDraft & { id: string }) =>
        aiApi.changePreferenceValue(id, draft).then((response) => response.data));
}

export function usePutAiPreferenceValueInForce() {
    return usePreferenceMutation((id: string) =>
        aiApi.putPreferenceValueInForce(id).then((response) => response.data));
}

export function useRestoreAiPreferenceValue() {
    return usePreferenceMutation((id: string) =>
        aiApi.restorePreferenceValue(id).then((response) => response.data));
}

export function useDiscardAiPreferenceValue() {
    return usePreferenceMutation((id: string) =>
        aiApi.discardPreferenceValue(id).then(() => undefined));
}

function usePreferenceMutation<Variables, Result>(
    mutationFunction: (variables: Variables) => Promise<Result>,
) {
    const queryClient = useQueryClient();

    return useMutation<Result, unknown, Variables>({
        mutationFn: mutationFunction,
        onSuccess:  () => queryClient.invalidateQueries({ queryKey: PREFERENCES }),
    });
}

/** One place the three caches that move together are named, so a new write cannot forget one. */
function useProviderMutation<Variables, Result>(
    mutationFunction: (variables: Variables) => Promise<Result>,
) {
    const queryClient = useQueryClient();

    return useMutation<Result, unknown, Variables>({
        mutationFn: mutationFunction,
        onSuccess:  () => {
            [SETTINGS, OVERVIEW, ASSISTANT].forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey });
            });
        },
    });
}

export type { ProviderConfiguration, UpsertProviderConfiguration };

// ── Agents ────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Keyed by surface, and it has to be. The two lists overlap — your own agents are also in the
 * installation's — so one key would let the administration screen's answer satisfy the settings page's
 * query and show somebody every agent there is on their own screen.
 */
const AGENTS = (surface: AgentSurface) => ['ai', 'agents', surface];

/**
 * Every agent in the installation — not to be confused with `useAgents`, which is one person's own.
 *
 * ⚠️ The names are deliberately different because the two answer different questions and are gated
 * differently: this one is behind `ai:administer` and discloses every agent there is.
 */
export function useEveryAgent(surface: AgentSurface = 'everyone') {
    return useQuery({
        queryKey: AGENTS(surface),
        queryFn:  () => aiApi.agents(surface).then((response) => response.data),
    });
}

export function useSetAgentEnabled(surface: AgentSurface = 'everyone') {
    return useAgentMutation(surface, ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
        aiApi.setAgentEnabled(surface, agentId, enabled).then((response) => response.data));
}

export function useRenameAgent(surface: AgentSurface = 'everyone') {
    return useAgentMutation(surface, ({ agentId, name }: { agentId: string; name: string }) =>
        aiApi.renameAgent(surface, agentId, name).then((response) => response.data));
}

export function useSetAgentAuthority(surface: AgentSurface = 'everyone') {
    return useAgentMutation(
        surface,
        ({ agentId, authority }: { agentId: string; authority: AgentAuthority }) =>
            aiApi.setAgentAuthority(surface, agentId, authority).then((response) => response.data));
}

export function useRevokeAgentConnection(surface: AgentSurface = 'everyone') {
    return useAgentMutation(
        surface,
        ({ agentId, connectionId }: { agentId: string; connectionId: string }) =>
            aiApi.revokeAgentConnection(surface, agentId, connectionId)
                .then((response) => response.data));
}

/**
 * ⚠️ Invalidates only the agents cache, unlike the provider writes above.
 *
 * <p>Switching an agent off changes nothing about which model is in force or whether the assistant
 * answers, so refetching those three would be refetching three things to show one — and the screen
 * would flicker for no reason anybody could point at.
 */
function useAgentMutation<Variables>(
    surface: AgentSurface,
    mutationFunction: (variables: Variables) => Promise<AgentView>,
) {
    const queryClient = useQueryClient();

    return useMutation<AgentView, unknown, Variables>({
        mutationFn: mutationFunction,
        onSuccess:  () => {
            // ⚠️ Both lists, not only the one that was showing. An agent switched off on the settings
            // page is switched off on the administration screen too, and a stale tab is how somebody
            // concludes the switch did nothing.
            queryClient.invalidateQueries({ queryKey: AGENTS(surface) });
            queryClient.invalidateQueries({
                queryKey: AGENTS(surface === 'mine' ? 'everyone' : 'mine'),
            });
        },
    });
}

/** ⚠️ Your own only. See {@link aiApi.discardAgent} for why there is no administrator's counterpart. */
export function useDiscardOwnAgent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (agentId: string) => aiApi.discardAgent(agentId).then(() => undefined),
        onSuccess:  () => {
            queryClient.invalidateQueries({ queryKey: AGENTS('mine') });
            queryClient.invalidateQueries({ queryKey: AGENTS('everyone') });
        },
    });
}

// ── An agent's own grants ────────────────────────────────────────────────────

const GRANTS = (surface: AgentSurface, agentId: string) =>
    ['ai', 'agents', surface, agentId, 'grants'];

/**
 * What one agent holds, beside what its owner could hand it.
 *
 * <p>⚠️ Only asked once the pane is open. An installation with twenty agents would otherwise fire
 * twenty requests to fill panes nobody opened, and every one of them resolves an owner's whole
 * effective permission set — the expensive half.
 */
export function useAgentGrants(surface: AgentSurface, agentId: string, enabled: boolean) {
    return useQuery({
        queryKey: GRANTS(surface, agentId),
        queryFn:  () => aiApi.agentGrants(surface, agentId).then((response) => response.data),
        enabled,
    });
}

export function useReplaceAgentGrants(surface: AgentSurface, agentId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (wanted: { permissions: string[]; placements: AgentPlacement[] }) =>
            aiApi.replaceAgentGrants(surface, agentId, wanted.permissions, wanted.placements)
                .then((response) => response.data),
        onSuccess: (view) => {
            // ⚠️ Seeded rather than invalidated: the answer IS the response, and refetching would
            // blank the pane somebody is looking at to arrive at the same thing.
            queryClient.setQueryData(GRANTS(surface, agentId), view);
            queryClient.invalidateQueries({ queryKey: AGENTS(surface) });
        },
    });
}

export type { AgentAuthority, AgentConnection, AgentView };
