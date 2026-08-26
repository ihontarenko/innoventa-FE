import { http } from "./http"

/** What a person needs to decide which credential to revoke — and nothing they could connect with. */
export interface KiCadTokenSummary {
  id: string
  name: string
  createdAt: string
  /** ⚠️ Null means "connected to nothing yet" — the answer somebody wants before revoking. */
  lastUsedAt: string | null
  revokedAt: string | null
}

/**
 * A freshly issued credential.
 *
 * ⚠️ **This is the only time `value` and `configuration` exist.** Nothing can produce them again — the
 * server keeps a hash, and a screen able to redisplay a credential would be that credential stored
 * twice, in a second place, for as long as the row lives.
 */
export interface IssuedKiCadToken {
  id: string
  name: string
  value: string
  /** The whole `.kicad_httplib` document, ready to save. */
  configuration: string
}

export const kicadApi = {
  tokens: (spaceId: string) => http.get<KiCadTokenSummary[]>(`/spaces/${spaceId}/kicad/tokens`),

  issue: (spaceId: string, name: string) =>
    http.post<IssuedKiCadToken>(`/spaces/${spaceId}/kicad/tokens`, { name }),

  revoke: (spaceId: string, tokenId: string) =>
    http.delete<void>(`/spaces/${spaceId}/kicad/tokens/${tokenId}`),
}
