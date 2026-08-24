import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query"
import { planAdministrationApi, workspaceAdministrationApi } from "@/api/entitlements"
import type {
  AdministeredOrganization,
  AdministeredSpace,
  AdministeredSpaceDetail,
  OrganizationPlan,
  Plan,
} from "@/api/entitlements"

/**
 * The plan catalogue, who is on what, and everything that changes either.
 *
 * ⚠️ **Every write here answers with the whole organisation**, and every one of them invalidates the
 * same prefix. A trial started, a plan moved and a gift issued all change the same three readings — the
 * list, the one account, and what that account may do — and a screen that refreshed only what it wrote
 * would show somebody a new tier beside the old usage meters.
 */
const ENTITLEMENT_KEYS = {
  all: ["entitlements"] as const,
  plans: ["entitlements", "plans"] as const,
  organizations: ["entitlements", "organizations"] as const,
  organization: (organizationId: string) => ["entitlements", "organization", organizationId] as const,
}

export function usePlanCatalogue() {
  return useQuery<Plan[]>({
    queryKey: ENTITLEMENT_KEYS.plans,
    queryFn: () => planAdministrationApi.catalogue().then((response) => response.data),
    // The catalogue comes from the policy document and changes when somebody saves one, not mid-visit.
    staleTime: 5 * 60_000,
  })
}

export function useAdministeredOrganizations() {
  return useQuery<AdministeredOrganization[]>({
    queryKey: ENTITLEMENT_KEYS.organizations,
    queryFn: () => planAdministrationApi.organizations().then((response) => response.data),
  })
}

export function useAdministeredOrganization(organizationId?: string) {
  return useQuery<OrganizationPlan>({
    queryKey: ENTITLEMENT_KEYS.organization(organizationId ?? ""),
    queryFn: () => planAdministrationApi.organization(organizationId!).then((response) => response.data),
    enabled: Boolean(organizationId),
  })
}

/**
 * Any write that changes what one account is entitled to.
 *
 * ⚠️ Written once because the four of them differ only in which request they send: four hand-rolled
 * mutations is how the fourth comes to invalidate three of the four keys.
 */
function useEntitlementMutation<Variables>(
  send: (variables: Variables) => Promise<{ data: OrganizationPlan }>,
): UseMutationResult<OrganizationPlan, unknown, Variables> {
  const queryClient = useQueryClient()

  return useMutation<OrganizationPlan, unknown, Variables>({
    mutationFn: (variables) => send(variables).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENTITLEMENT_KEYS.all }),
  })
}

export function useAssignPlan() {
  return useEntitlementMutation(({ organizationId, planCode }: { organizationId: string; planCode: string }) =>
    planAdministrationApi.assignPlan(organizationId, { planCode }),
  )
}

export function useStartTrial() {
  return useEntitlementMutation(
    ({ organizationId, planCode, until }: { organizationId: string; planCode: string; until: string }) =>
      planAdministrationApi.startTrial(organizationId, { planCode, until }),
  )
}

export function useEndTrial() {
  return useEntitlementMutation(({ organizationId }: { organizationId: string }) =>
    planAdministrationApi.endTrial(organizationId),
  )
}

export function useIssueGift() {
  return useEntitlementMutation(
    ({
      organizationId,
      capability,
      reason,
      allowance,
      period,
      until,
    }: {
      organizationId: string
      capability: string
      reason: string
      allowance?: number | null
      period?: string | null
      until?: string | null
    }) => planAdministrationApi.issueGift(organizationId, { capability, reason, allowance, period, until }),
  )
}

/**
 * Withdrawing one grant.
 *
 * ⚠️ Apart from the four above because it answers with **nothing** rather than with the organisation —
 * a grant is addressed by its own identifier, and the route does not know which account it belonged to.
 * So the invalidation is the whole prefix, which is also the only correct answer here.
 */
export function useWithdrawGrant() {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, string>({
    mutationFn: (grantId) => planAdministrationApi.withdrawGrant(grantId).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ENTITLEMENT_KEYS.all }),
  })
}

// ── Governing workspaces from the platform ───────────────────────────────────

const WORKSPACE_KEYS = {
  all: ["workspace-administration"] as const,
  list: (search: string) => ["workspace-administration", "list", search] as const,
  one: (spaceId: string) => ["workspace-administration", spaceId] as const,
}

export function useAdministeredSpaces(search?: string) {
  return useQuery<AdministeredSpace[]>({
    queryKey: WORKSPACE_KEYS.list(search ?? ""),
    queryFn: () => workspaceAdministrationApi.list(search).then((response) => response.data),
    placeholderData: keepPreviousData,
  })
}

/**
 * ⚠️ **Fetched on demand, never prefetched for the whole list.** Opening somebody else's workspace is
 * recorded server-side as a sensitive read: an administrator looking into a customer's arrangements
 * leaves a trace, and a trace per row scrolled past would be no trace at all.
 */
export function useAdministeredSpace(spaceId?: string) {
  return useQuery<AdministeredSpaceDetail>({
    queryKey: WORKSPACE_KEYS.one(spaceId ?? ""),
    queryFn: () => workspaceAdministrationApi.open(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

function useWorkspaceMutation<Variables>(send: (variables: Variables) => Promise<{ data: AdministeredSpaceDetail }>) {
  const queryClient = useQueryClient()

  return useMutation<AdministeredSpaceDetail, unknown, Variables>({
    mutationFn: (variables) => send(variables).then((response) => response.data),
    onSuccess: (detail) => {
      // ⚠️ Seeded rather than invalidated: the answer IS the response, and a refetch would blank the
      // dialog somebody is looking at to arrive at the same thing. The list still goes, because a
      // withheld module changes what a row says.
      queryClient.setQueryData(WORKSPACE_KEYS.one(detail.space.id), detail)
      queryClient.invalidateQueries({ queryKey: WORKSPACE_KEYS.all })
    },
  })
}

export function useWithholdCapability() {
  return useWorkspaceMutation(({ spaceId, capability, reason }: { spaceId: string; capability: string; reason: string }) =>
    workspaceAdministrationApi.withhold(spaceId, capability, { reason }),
  )
}

export function useReleaseCapability() {
  return useWorkspaceMutation(({ spaceId, capability }: { spaceId: string; capability: string }) =>
    workspaceAdministrationApi.release(spaceId, capability),
  )
}
