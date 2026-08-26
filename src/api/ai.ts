import { createApiClient } from "./http"
import { LIBRARY_ROUTES } from "./libraryRoutes";

/**
 * The machinery behind the assistant and the protocol endpoint, as one screen reads it.
 *
 * <p>⚠️ <strong>These are the library's own routes now.</strong> `jmouse-ai-management` serves all six,
 * mounted at `/jmouse/ai/api` (`jmouse.ai.management.prefix`) — an address nobody would invent by accident,
 * so a request log can say at a glance which handler the library ships. The price is that the Vite
 * proxy and `nginx.conf` each need that second prefix; leave either out and every call here answers
 * 404 while the backend is perfectly healthy. Innoventa's own copy of that module — a controller, a service, a repository and
 * eight DTOs — is deleted: it existed because a library's handler cannot carry `@RequiresAccess`, and
 * `ExternalAccessRules` fixed that at the root by letting a product declare a requirement *about* a
 * foreign type. See `AiToolConfiguration`.
 *
 * <p>⚠️ <strong>Still two permissions.</strong> Everything that reads is behind `ai:read`; the
 * configuration routes are behind `ai:administer`, which decides what this installation sends somebody
 * else's servers and holds the key it pays with.
 *
 * <p>⚠️ <strong>No response here carries a provider key</strong>, and none can be made to: the shapes
 * have no field for one, and the server reduces the stored credential to `keyConfigured` before
 * anything HTTP-shaped sees it.
 */

/** What is actually in force, as the settings source resolved it — not what a row says. */
export interface ActiveProvider {
    providerName:   string;
    model:          string;
    apiUrl?:        string;
    maximumTokens:  number;
    keyConfigured:  boolean;
    /**
     * Whether a call could actually be sent — a key is set, **or** this provider needs none.
     *
     * ⚠️ Not the same as `keyConfigured`, and conflating them is a real bug: a model running on this
     * machine has no credential to give, so reading "no key" as "will not work" reports the assistant
     * off while it is perfectly able to answer.
     */
    usable:         boolean;
}

export interface AiOverview {
    /** Null when nothing is in force, or when two rows are and the library refuses to choose. */
    activeProvider:     ActiveProvider | null;
    /** A model **and** a key. The two halves are reported apart so the screen can say which is missing. */
    assistantAvailable: boolean;
    /**
     * ⚠️ Whether anything records a trail at all. An installation with no trail and one where nothing
     * has been called produce the same empty list and mean opposite things.
     */
    trailRecorded:      boolean;
    publishedActions:   number;
    /** Namespaces, not actions — eight actions may be three tools, so both numbers are reported. */
    publishedTools:     number;
}

/** One action the catalogue publishes — to a connected client and to the assistant alike. */
export interface PublishedAction {
    publishedName:      string;
    qualifiedName:      string;
    title:              string;
    description:        string;
    inputSchema:        Record<string, unknown>;
    requiredPermission: string;
    readOnly:           boolean;
    destructive:        boolean;
    scopeConfined:      boolean;
    /** `LOCAL`, or `REMOTE` where it is forwarded to a server this installation connected to. */
    origin:             string;
}

export interface ToolCall {
    operationId:   string;
    callerId:      string;
    actingSubject: string;
    qualifiedName: string;
    scopeId?:      string;
    scopeLabel?:   string;
    /** The verdict or the refusal reason — the column worth scanning. */
    outcome:       string;
    affectedCount: number;
    at:            string;
}

/** Counted by caller, action and outcome, with the outcome kept in the key rather than summed away. */
export interface UsageTotal {
    callerId:      string;
    qualifiedName: string;
    outcome:       string;
    calls:         number;
    tokens:        number;
    lastCalledAt:  string;
}

export interface ProviderConfiguration {
    id:            string;
    provider:      string;
    model:         string;
    apiUrl?:       string;
    maximumTokens: number;
    active:        boolean;
    keyConfigured: boolean;
    createdAt:     string;
    updatedAt:     string;
}

/**
 * One provider a configuration may name.
 *
 * ⚠️ `requiresKey: false` is a real answer, not a relaxation — a model on this machine has no
 * credential to give, and demanding one would make the only free option the one nobody can switch on.
 */
export interface SupportedProvider {
    name:          string;
    defaultApiUrl: string | null;
    requiresKey:   boolean;
    note:          string | null;
}

export interface ProviderConfigurations {
    supportedProviders: string[];
    /** The same list with an address, a note and whether a key is needed, in reading order. */
    providers:          SupportedProvider[];
    configurations:     ProviderConfiguration[];
}

/** What somebody typed, on the way in — the library calls it a draft. */
export interface UpsertProviderConfiguration {
    provider:      string;
    model:         string;
    /** ⚠️ Blank on an update means *leave the stored key alone*, never *clear it*. */
    apiKey?:       string;
    apiUrl?:       string;
    maximumTokens: number;
}

/**
 * One stored wording of a setting — a whole prompt, with a name somebody gave it.
 *
 * ⚠️ **Several per setting, one in force**, deliberately the shape a provider configuration already
 * has: keeping the long prompt while trying the short one, and switching back with a press rather than
 * a paste. The assistant reads the one in force and nothing else.
 */
export interface AiPreferenceValue {
    id:         string;
    label:      string;
    value:      string;
    inForce:    boolean;
    /**
     * Which wording this build ships that this row started as, or null for one somebody wrote here.
     *
     * ⚠️ Provenance only — nothing reads it at runtime. What it buys is *put this back to what the
     * build ships*, which is the difference between experimenting and losing the original.
     */
    shippedKey: string | null;
    /** Whether the text still equals what the build ships for that wording. Computed by the server. */
    asShipped:  boolean;
    createdAt:  string;
    changedAt:  string;
}

/**
 * One declared setting with everything stored for it.
 *
 * ⚠️ **Never empty in practice.** A setting with no rows is seeded from what the product ships on the
 * first read, so opening this screen finds the shipped wordings rather than an empty table.
 */
export interface AiPreference {
    name:        string;
    title:       string;
    description: string;
    /** Whether a screen should offer a text area rather than a single line. Presentation only. */
    multiline:   boolean;
    values:      AiPreferenceValue[];
}

/** What somebody typed, on the way in. */
export interface AiPreferenceDraft {
    label: string;
    value: string;
}

/**
 * Where `jmouse-ai-management` answers.
 *
 * <p>`/jmouse/ai/api` because `jmouse.ai.management.prefix` says so, which is the whole of what this product
 * decides about these routes — the paths below are the library's own spelling and are not ours to
 * rename.
 *
 * <p>⚠️ <strong>Deliberately NOT under `/api`</strong>, so a request log can tell a handler the library
 * ships from one Innoventa wrote. The cost of that is a second base path, and therefore a second
 * client — built by {@link createApiClient} rather than hand-rolled, so the bearer token, the refresh
 * queue and the performance trail are the same ones every other call gets. Anything mounted at a new
 * prefix must also be taught to the Vite proxy and to `UI/nginx.conf`, or it is reachable from the
 * backend and from nowhere else.
 */
const managementHttp = createApiClient(LIBRARY_ROUTES.ai);

/**
 * Whose permissions an agent acts with.
 *
 * `INHERITED` — everything its owner holds, followed live. `RESTRICTED` — its own grants, capped by
 * its owner's. ⚠️ A different question from whether the agent is switched on at all.
 */
export type AgentAuthority = 'INHERITED' | 'RESTRICTED';

export interface AgentConnection {
    id:               string;
    agentId:          string;
    clientName:       string;
    issuedAt:         string;
    refreshExpiresAt: string;
    lastUsedAt:       string | null;
    revokedAt:        string | null;
}

/**
 * One agent with the clients connected to it.
 *
 * ⚠️ `connections` includes revoked ones and `connectionCount` does not — a screen shows history, and
 * "3 clients" must not count endings.
 */
export interface AgentView {
    id:              string;
    ownerReference:  string | null;
    name:            string;
    authority:       AgentAuthority;
    enabled:         boolean;
    createdAt:       string;
    lastActiveAt:    string | null;
    connectionCount: number;
    connections:     AgentConnection[];
}

// ── An agent's own grants ────────────────────────────────────────────────────
//
// Three axes, all of them opaque to the library and all of them this product's own
// words: a permission, a place (a workspace here, a project in the other product),
// and a role. That is what lets one screen edit an agent in both.

/** Somewhere an agent can be put to work — a workspace here. */
export interface AgentPlace {
    id:    string;
    label: string;
}

/** A role it can be given, and whether that role has to be pinned to a place. */
export interface AgentRole {
    name:        string;
    placeScoped: boolean;
}

/** One role held in one place — `placeId` null for an installation-wide role. */
export interface AgentPlacement {
    roleName: string;
    placeId:  string | null;
}

export interface AgentHeld {
    permissions: string[];
    placements:  AgentPlacement[];
}

/**
 * What the agent's OWNER could hand down.
 *
 * ⚠️ Not what the installation defines. An agent's set is intersected with its owner's on every
 * request and in every scope, so offering more would let somebody grant into a void — and the result
 * looks, from outside, exactly like the agent being broken.
 */
export interface AgentOffer {
    permissions: string[];
    places:      AgentPlace[];
    roles:       AgentRole[];
}

export interface AgentGrantsView {
    held:  AgentHeld;
    offer: AgentOffer;
}

/**
 * Which agents a call is about — every one in the installation, or only the caller's own.
 *
 * <p>⚠️ Two route families rather than a query parameter, and the difference is authorization. An
 * administrator's routes take an owner and are gated on `ai:administer`; a person's own re-derive the
 * owner from the session and refuse an agent that is not theirs. Everything past that is identical, so
 * one set of functions serves both and one component renders both — here and in the other product.
 */
export type AgentSurface = 'everyone' | 'mine';

function agentsPath(surface: AgentSurface): string {
    return surface === 'mine' ? '/my-agents' : '/agents';
}

export const aiApi = {
    overview: () =>
        managementHttp.get<AiOverview>(`/overview`),

    /** ⚠️ `/tools`, not `/actions` — the library names the endpoint after the catalogue, not the row. */
    actions: () =>
        managementHttp.get<PublishedAction[]>(`/tools`),

    /**
     * ⚠️ Narrowing to one action is a different route (`/tools/{publishedName}/calls`), so this takes
     * only a caller. Passing an `action` here would have been accepted and silently ignored.
     */
    calls: (parameters: { caller?: string; limit?: number } = {}) =>
        managementHttp.get<ToolCall[]>(`/calls`, { params: parameters }),

    callsOf: (publishedName: string, limit?: number) =>
        managementHttp.get<ToolCall[]>(`/tools/${publishedName}/calls`, { params: { limit } }),

    usage: (parameters: { caller?: string; action?: string } = {}) =>
        managementHttp.get<UsageTotal[]>(`/usage`, { params: parameters }),

    configurations: () =>
        managementHttp.get<ProviderConfigurations>(`/configurations`),

    create: (payload: UpsertProviderConfiguration) =>
        managementHttp.post<ProviderConfiguration>(`/configurations`, payload),

    update: (id: string, payload: UpsertProviderConfiguration) =>
        managementHttp.put<ProviderConfiguration>(`/configurations/${id}`, payload),

    /** ⚠️ Putting one in force takes whatever was in force out of it — one operation, not two. */
    activate: (id: string) =>
        managementHttp.patch<ProviderConfiguration>(`/configurations/${id}/in-force`),

    deactivate: (id: string) =>
        managementHttp.delete<ProviderConfiguration>(`/configurations/${id}/in-force`),

    delete: (id: string) =>
        managementHttp.delete(`/configurations/${id}`),

    // ── Preferences ───────────────────────────────────────────────────────────
    //
    // One route pair for every setting rather than one per setting: a preference is
    // a declared name, some prose and a string, so a second one costs a bean in the
    // backend and nothing at all here.

    /** ⚠️ Reading seeds: a setting with no rows is filled from what the build ships before this answers. */
    preferences: () =>
        managementHttp.get<AiPreference[]>(`/preferences`),

    /** A new wording, idle — putting it in force is a second request. */
    addPreferenceValue: (name: string, draft: AiPreferenceDraft) =>
        managementHttp.post<AiPreferenceValue>(`/preferences/${name}`, draft),

    changePreferenceValue: (id: string, draft: AiPreferenceDraft) =>
        managementHttp.put<AiPreferenceValue>(`/preferences/values/${id}`, draft),

    /** ⚠️ Takes whatever was in force out of it — one operation, not two. */
    putPreferenceValueInForce: (id: string) =>
        managementHttp.patch<AiPreferenceValue>(`/preferences/values/${id}/in-force`),

    /** Back to the text this build ships for it. ⚠️ Refuses a wording nobody seeded. */
    restorePreferenceValue: (id: string) =>
        managementHttp.post<AiPreferenceValue>(`/preferences/values/${id}/shipped`),

    /** ⚠️ Refuses the one in force, so the assistant is never left with nothing to be told. */
    discardPreferenceValue: (id: string) =>
        managementHttp.delete(`/preferences/values/${id}`),

    // ── Agents ────────────────────────────────────────────────────────────────
    //
    // The same library routes Tessera reads, over the same ports — and now over the
    // same table too. An agent here used to be a sub-account with a ceiling and space
    // memberships; it is a row in the library's own table since the re-architecture,
    // and this file did not change when it moved, which is what a port buys.

    agents: (surface: AgentSurface = 'everyone', limit = 100) =>
        managementHttp.get<AgentView[]>(`${agentsPath(surface)}`, {
            // ⚠️ Not sent to the self-scoped route, which is bounded by ownership rather than a count.
            params: surface === 'mine' ? undefined : { limit },
        }),

    setAgentEnabled: (surface: AgentSurface, agentId: string, enabled: boolean) =>
        managementHttp.patch<AgentView>(
            `${agentsPath(surface)}/${agentId}/enabled`, undefined, { params: { enabled } }),

    renameAgent: (surface: AgentSurface, agentId: string, name: string) =>
        managementHttp.patch<AgentView>(`${agentsPath(surface)}/${agentId}/name`, { name }),

    /** ⚠️ Restricting takes effect on the next call, and an ungranted agent can then do nothing. */
    setAgentAuthority: (surface: AgentSurface, agentId: string, authority: AgentAuthority) =>
        managementHttp.patch<AgentView>(`${agentsPath(surface)}/${agentId}/authority`, { authority }),

    revokeAgentConnection: (surface: AgentSurface, agentId: string, connectionId: string) =>
        managementHttp.delete<AgentView>(
            `${agentsPath(surface)}/${agentId}/connections/${connectionId}`),

    /**
     * Throws one of your own away.
     *
     * <p>⚠️ Only ever your own — there is no administrator's counterpart, deliberately. Discarding
     * somebody else's agent from an administration screen is indistinguishable, afterwards, from that
     * person having done it, and the switch beside it stops one just as completely while leaving it
     * possible to explain what happened.
     */
    discardAgent: (agentId: string) =>
        managementHttp.delete<void>(`/my-agents/${agentId}`),

    agentGrants: (surface: AgentSurface, agentId: string) =>
        managementHttp.get<AgentGrantsView>(`${agentsPath(surface)}/${agentId}/grants`),

    /** ⚠️ The whole set, never a delta — two people editing with deltas merge into a set neither chose. */
    replaceAgentGrants: (
        surface: AgentSurface, agentId: string, permissions: string[], placements: AgentPlacement[],
    ) =>
        managementHttp.put<AgentGrantsView>(
            `${agentsPath(surface)}/${agentId}/grants`, { permissions, placements }),
};
