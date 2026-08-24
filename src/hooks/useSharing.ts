import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sharingApi } from "@/api/sharing";
import type { SharingDashboard, ShareLinkKind, SharedResourceType } from "@/api/sharing";

const CONFIG_KEY = ['sharing-config'];

export function useSharingConfig() {
    return useQuery<SharingDashboard>({
        queryKey: CONFIG_KEY,
        queryFn:  () => sharingApi.getConfig().then((response) => response.data),
        staleTime: 30_000,
    });
}

export function useMintShare() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ kind, resourceType, resourceId, pattern }: {
            kind: ShareLinkKind; resourceType: SharedResourceType; resourceId: string; pattern?: string;
        }) => sharingApi.mint(kind, resourceType, resourceId, pattern).then((response) => response.data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: CONFIG_KEY }),
    });
}

export function useRevokeShare() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ resourceType, resourceId, kind }: {
            resourceType: SharedResourceType; resourceId: string; kind: ShareLinkKind;
        }) => sharingApi.revoke(resourceType, resourceId, kind),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: CONFIG_KEY }),
    });
}

export function useUpdateSharePattern() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ resourceType, kind, pattern }: {
            resourceType: SharedResourceType; kind: ShareLinkKind; pattern: string;
        }) => sharingApi.updatePattern(resourceType, kind, pattern).then((response) => response.data),
        onSuccess: (dashboard) => queryClient.setQueryData(CONFIG_KEY, dashboard),
    });
}

export function useUpdateSharePolicy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ resourceType, resourceId, allowedOrigins }: {
            resourceType: SharedResourceType; resourceId: string; allowedOrigins: string[];
        }) => sharingApi.updatePolicy(resourceType, resourceId, allowedOrigins).then((response) => response.data),
        onSuccess: (dashboard) => queryClient.setQueryData(CONFIG_KEY, dashboard),
    });
}
