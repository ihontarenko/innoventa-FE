import { UserManager, WebStorageStateStore } from "oidc-client-ts"

/**
 * A **second** sign-in, for Kiwi and nothing else (INVT-0097).
 *
 * <h2>⚠️ This is not how you sign in to Innoventa, and it must never become that</h2>
 *
 * Innoventa authenticates on its own: `/api/auth/*` mints its token pair, `innoventa.access` in
 * `localStorage`, refreshed by `api/http.ts`. **Nothing here touches any of it.** This manager exists
 * because the wiki lives in another product: Kiwi is the only authority over who may read a page
 * (`KW-1` §1), it reads the person from an **Identity** token, and Innoventa's own token is not one.
 *
 * So a browser here ends up holding two tokens on purpose — Innoventa's for Innoventa, Identity's for
 * Kiwi. Ivan chose this shape over the alternative (Innoventa's login *becoming* Identity) precisely
 * because it is **incremental**: nothing about this product's authentication changes, and only the
 * pages screen asks.
 *
 * <h2>⚠️ Why the button so often costs nobody a password</h2>
 *
 * If the person is already signed in at Identity — because another product here signed them in, or
 * because Innoventa's own login was linked to it — the authorization request comes straight back with
 * a code and no prompt at all. That is the difference between "connect" and "sign in again", and it is
 * why this reads as one click rather than a second account.
 *
 * <h2>⚠️ Where Identity is, as seen from THIS browser</h2>
 *
 * `localhost` cannot be the fallback, because it is not a place — it is whoever is asking. A phone
 * opening this interface at the machine's LAN address would be sent to sign in at *its own*
 * `localhost:9090`, and the failure reads as Identity being down rather than as an address being
 * wrong. Identity runs beside this interface, so the honest default is the host the browser already
 * reached, on Identity's port.
 *
 * ⚠️ **The other half of this lives in Identity and is NOT derivable.** OAuth matches `redirect_uri`
 * exactly, so every address this interface is opened at must be registered there
 * (`identity.clients.innoventa.redirect-uris`). The authority can be inferred; the registration cannot.
 *
 * ⚠️ **And the PATH is this product's own — `/auth/identity/callback`, not the
 * `/login/oauth2/code/identity` every sibling interface uses.** `vite.config.ts` proxies `/login` to
 * Innoventa's backend, which owns that path for its Google and GitHub sign-ins; a callback sent there
 * would leave the SPA entirely and land on a server that knows nothing about this flow.
 */
const identityAuthority =
  import.meta.env.VITE_IDENTITY_ISSUER ??
  `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_IDENTITY_PORT ?? "9090"}`

/**
 * ⚠️ **`innoventa-web`, and it is a PUBLIC client since 2026-08-20.** Its entry in Identity was
 * confidential and carried a secret, with a note saying not to change it unasked; Ivan asked. A browser
 * has nowhere safe to keep a secret, so this is Authorization Code + PKCE like every other interface
 * here — and `aud: innoventa`, which Kiwi's `accepted-audiences` now lists.
 */
export const identityUserManager = new UserManager({
  authority: identityAuthority,
  client_id: import.meta.env.VITE_IDENTITY_CLIENT_ID ?? "innoventa-web",
  redirect_uri: `${window.location.origin}/auth/identity/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",

  // ⚠️ Its own storage key prefix, or the two sessions overwrite each other's state. `oidc-client-ts`
  // namespaces by authority and client id, so this is already distinct from any other product's — what
  // it must not collide with is Innoventa's own `innoventa.*` keys, and it does not.
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
})

/** The Identity access token, or null where this browser has not connected one. */
export async function identityAccessToken(): Promise<string | null> {
  const user = await identityUserManager.getUser()

  // ⚠️ `expired` is checked rather than trusted: a stored user survives its own token, and a call
  // carrying a dead one comes back 401 from Kiwi — which this product would then have to explain.
  return user && !user.expired ? user.access_token : null
}

/**
 * Start the connection.
 *
 * ⚠️ Kept as a function rather than wired to a route so the *screen* decides when to ask. The pages
 * screen asks; nothing else in this product does, and nothing else should.
 */
export function connectIdentity(returnTo: string = window.location.pathname): Promise<void> {
  // The state comes back on the other side, so the person lands where they pressed the button.
  return identityUserManager.signinRedirect({ state: returnTo })
}

/** Forget it, without touching Innoventa's own session. */
export function disconnectIdentity(): Promise<void> {
  return identityUserManager.removeUser()
}

/**
 * Whether this browser holds an Identity connection at all.
 *
 * <h2>⚠️ Ask this rather than reading it off a failed request</h2>
 *
 * The obvious approach — call Kiwi and treat a 401 as *"not connected"* — does not work, and the way
 * it fails is the expensive kind. **Kiwi's category tree answers `200` with an empty array to an
 * anonymous caller**, because an unauthenticated subject legitimately holds nothing. So *"you have not
 * connected"* and *"nothing has been shared with you"* arrive as the identical response, and a screen
 * that guessed would tell somebody their wiki is empty when one click would have filled it.
 *
 * <p>⚠️ This is a **local** question with a local answer, which is why it can be asked at all: the
 * token is in this browser's store or it is not, and no server is involved.
 */
export async function hasIdentityConnection(): Promise<boolean> {
  return (await identityAccessToken()) !== null
}
