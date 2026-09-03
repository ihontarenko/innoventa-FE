import { http } from "./http"

export type ShareLinkKind = 'SHARE' | 'OG' | 'CUSTOM';
export type SharedResourceType = 'PAGE' | 'FORM' | 'ENTRY' | 'FILE';

/** The in-app public route each resource type's SHARE token renders at. */
const PUBLIC_ROUTE: Record<SharedResourceType, string> = {
    PAGE:     '/_/page',
    FORM:     '/_/form',
    ENTRY:    '/_/entry',
    FILE:     '/_/viewer',
};

export interface ShareResourceOption {
    id:    string;
    label: string;
}

/** One resource type's variable palette and its shareable resources. */
export interface ShareTypeConfig {
    resourceType: SharedResourceType;
    variables:    string[];
    options:      ShareResourceOption[];
}

/** The URL pattern for a (type, kind); empty means "opaque token" (REGULAR/OG) or default (CUSTOM). */
export interface SharePattern {
    resourceType: SharedResourceType;
    kind:         ShareLinkKind;
    pattern:      string;
}

/** One minted link on a resource. */
export interface ShareLinkView {
    resourceType: SharedResourceType;
    resourceId:   string;
    kind:         ShareLinkKind;
    token:        string;
}

/** A shared resource with every link it owns, its public token, and its embed allow-list. */
export interface SharedResourceRow {
    resourceType:   SharedResourceType;
    resourceId:     string;
    title:          string;
    publicToken:    string | null;
    links:          ShareLinkView[];
    allowedOrigins: string[];
}

export interface SharingDashboard {
    types:     ShareTypeConfig[];
    patterns:  SharePattern[];
    resources: SharedResourceRow[];
}

export const sharingApi = {
    getConfig: () =>
        http.get<SharingDashboard>('/admin/shares/config'),

    mint: (kind: ShareLinkKind, resourceType: SharedResourceType, resourceId: string, pattern?: string) =>
        http.post<ShareLinkView>('/admin/shares', { kind, resourceType, resourceId, pattern: pattern || undefined }),

    revoke: (resourceType: SharedResourceType, resourceId: string, kind: ShareLinkKind) =>
        http.delete(`/admin/shares/${resourceType}/${resourceId}/${kind}`),

    updatePattern: (resourceType: SharedResourceType, kind: ShareLinkKind, pattern: string) =>
        http.put<SharingDashboard>(`/admin/shares/patterns/${resourceType}/${kind}`, { pattern }),

    preview: (resourceType: SharedResourceType, kind: ShareLinkKind, resourceId: string, pattern?: string) =>
        http.get<{ token: string }>('/admin/shares/preview', {
            params: { resourceType, kind, resourceId, pattern: pattern || undefined },
        }),

    updatePolicy: (resourceType: SharedResourceType, resourceId: string, allowedOrigins: string[]) =>
        http.put<SharingDashboard>(`/admin/shares/policy/${resourceType}/${resourceId}`, { allowedOrigins }),
};

/** The `<script>` snippet a host site pastes to embed a shared category (no iframe). */
export function embedSnippet(publicToken: string): string {
    const origin = window.location.origin;
    return `<div id="innoventa-embed"></div>\n`
        + `<script src="${origin}/innoventa-embed.js" data-token="${publicToken}" data-target="innoventa-embed"></script>`;
}

/** What a public address (a CUSTOM pretty path, or any token) resolves to — used by the pretty-URL route. */
export interface PublicResolveResponse {
    resourceType: SharedResourceType;
    resourceId:   string;
    kind:         ShareLinkKind;
    mode:         'REDIRECT' | 'RENDER_IN_PLACE';
    shareToken:   string | null;
    path:         string | null;
    targetUrl:    string | null;
}

export const publicSharingApi = {
    /** Resolve a pretty path (no auth) — for the SPA's catch-all pretty-URL route. */
    resolve: (path: string) => http.get<PublicResolveResponse>('/public/shares/resolve', { params: { path } }),
};

/** The in-app public route a resource type's token renders at, e.g. `/_/category/{token}`. */
export function publicRouteFor(resourceType: SharedResourceType, token: string): string {
    return `${PUBLIC_ROUTE[resourceType]}/${token}`;
}

/**
 * The public URL a link resolves at: SHARE is the resource's own `/_/{type}/{token}` page, OG is the
 * unfurl short link under `/share`, and CUSTOM is a pretty top-level path.
 */
export function shareLinkUrl(link: ShareLinkView): string {
    const origin = window.location.origin;
    if (link.kind === 'CUSTOM') {
        return `${origin}/${link.token}`;
    }
    if (link.kind === 'OG') {
        return `${origin}/share/${link.token}`;
    }
    return `${origin}${PUBLIC_ROUTE[link.resourceType]}/${link.token}`;
}
