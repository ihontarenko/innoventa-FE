import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { auditApi, myActivityApi } from "@/api/audit"
import type {
  AuditActorOption,
  AuditCatalogView,
  AuditEventDetailView,
  AuditEventFilters,
  AuditEventView,
  AuditMetaCatalogView,
  AuditScopeOption,
  MyActivityDetailView,
  MyActivityFilters,
} from "@/api/audit"
import type { Page } from "@/api/forms"

/**
 * A page of the log.
 *
 * The filters are part of the cache key, so changing a facet is a new query rather than a mutation of
 * the current one — which is what lets the drawer stay open over a refetch without the row underneath it
 * changing identity.
 */
export function useAuditEvents(filters: AuditEventFilters, page: number, size = 50) {
  return useQuery<Page<AuditEventView>>({
    queryKey: ["audit-events", filters, page, size],
    queryFn: () => auditApi.listEvents(filters, page, size).then((response) => response.data),
    staleTime: 15_000,
  })
}

export function useAuditEvent(eventId: string | null) {
  return useQuery<AuditEventDetailView>({
    queryKey: ["audit-event", eventId],
    queryFn: () => auditApi.getEvent(eventId!).then((response) => response.data),
    enabled: eventId !== null,
  })
}

/**
 * The facet vocabulary, which comes from the backend's action registry rather than from a query over
 * recorded events — so every module and action is offered before the first matching event exists, and an
 * empty result means nothing happened rather than that the reader picked an unknown value.
 */
export function useAuditCatalog() {
  return useQuery<AuditCatalogView>({
    queryKey: ["audit-catalog"],
    queryFn: () => auditApi.getCatalog().then((response) => response.data),
    staleTime: Infinity,
  })
}

/** Actors and scopes are the two facets nobody can declare in advance, so they come from the data. */
export function useAuditActors() {
  return useQuery<AuditActorOption[]>({
    queryKey: ["audit-actors"],
    queryFn: () => auditApi.listActors().then((response) => response.data),
    staleTime: 60_000,
  })
}

export function useAuditScopes() {
  return useQuery<AuditScopeOption[]>({
    queryKey: ["audit-scopes"],
    queryFn: () => auditApi.listScopes().then((response) => response.data),
    staleTime: 60_000,
  })
}

/**
 * The meta-key catalogue.
 *
 * ⚠️ **Never refetched on its own**: it only changes when somebody scans, and a background refetch would
 * make the reported "last scanned" time drift without anything having happened. The scan mutation writes
 * its own result straight into this cache.
 */
export function useAuditMetaKeys() {
  return useQuery<AuditMetaCatalogView>({
    queryKey: ["audit-meta-keys"],
    queryFn: () => auditApi.getMetaKeys().then((response) => response.data),
    staleTime: Infinity,
  })
}

export function useScanAuditMetaKeys() {
  const queryClient = useQueryClient()

  return useMutation<AuditMetaCatalogView>({
    mutationFn: () => auditApi.scanMetaKeys().then((response) => response.data),
    onSuccess: (catalogue) => queryClient.setQueryData(["audit-meta-keys"], catalogue),
  })
}

/**
 * Your own history — the same store, narrowed by the server to the events under your authority.
 *
 * ⚠️ **Cached apart from the system-wide log** rather than as another set of filters over it, because the
 * two are different answers: this one carries what destroyed records used to hold, and that must never
 * end up in a cache entry an oversight screen could read.
 */
export function useMyActivity(filters: MyActivityFilters, page: number, size = 25) {
  return useQuery<Page<AuditEventView>>({
    queryKey: ["my-activity", filters, page, size],
    queryFn: () => myActivityApi.listEvents(filters, page, size).then((response) => response.data),
    staleTime: 15_000,
  })
}

export function useMyActivityEvent(eventId: string | null) {
  return useQuery<MyActivityDetailView>({
    queryKey: ["my-activity-event", eventId],
    queryFn: () => myActivityApi.getEvent(eventId!).then((response) => response.data),
    enabled: eventId !== null,
  })
}
