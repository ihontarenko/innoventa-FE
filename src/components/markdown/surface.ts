import { useMemo } from "react"

/**
 * Where a page's markdown is being rendered.
 *
 * ⚠️ **One knob, and it decides exactly one thing:** how the server-resolved `:::` blocks — part,
 * stock, location, datasheet — get their data. The client-rendered directives (`;;;mermaid`,
 * `;;;wavedrom`, callouts, YouTube, KaTeX) need no server and render identically on every surface, so
 * they are not this type's business.
 *
 * | Surface | Blocks resolve… |
 * |---|---|
 * | `app` | against the private endpoint, in full, for a reader this product signed in |
 * | `publicShare` | by the share token of a page published out of THIS database — only the public-safe subset |
 * | `publicKiwi` | by the page's Kiwi address, anonymously — the same subset, out of a document Kiwi holds |
 * | `inert` | not at all; server blocks show a quiet notice and the client directives still render |
 *
 * ⚠️ **The two public surfaces are not one surface with two addresses.** They differ in who holds the
 * document the allowlist is computed from: `publicShare` reads a row this product owns, `publicKiwi`
 * re-fetches the text from Kiwi as a granted product. The policy applied to each is identical — which
 * is why it is tempting to merge them, and why merging them would put one product's authority behind
 * the other's content.
 *
 * ⚠️ `publicCategory` is NOT coming back. It resolved blocks inside a shared folder subtree, and
 * publishing a folder is something this product no longer does — the public manual is Kiwi's, embedded.
 */
export type MarkdownSurface =
  | { readonly kind: "app" }
  | { readonly kind: "publicShare"; readonly shareToken: string }
  | { readonly kind: "publicKiwi"; readonly address: string }
  | { readonly kind: "inert" }

export const APP_SURFACE: MarkdownSurface = { kind: "app" }

/** Resolves nothing server-side; only the client directives render. */
export const INERT_SURFACE: MarkdownSurface = { kind: "inert" }

/**
 * A page published out of this product, addressed by the token in its link.
 *
 * ⚠️ **The token is the whole authorisation**, so the server matches every requested directive against
 * the text it looks up itself — the allowlist is never something the visitor sent.
 */
export function publicShareSurface(shareToken: string): MarkdownSurface {
  return { kind: "publicShare", shareToken }
}

/**
 * A page of the public manual, addressed the way a link addresses it (`KW-1` §7).
 *
 * ⚠️ **The address is all the server gets, and that is deliberate.** It re-fetches the document from
 * Kiwi itself, as a granted product, and matches every requested directive against *that* text — so the
 * allowlist can never be something the visitor sent.
 */
export function publicKiwiSurface(address: string): MarkdownSurface {
  return { kind: "publicKiwi", address }
}

/**
 * What the plugins are told on every render.
 *
 * ⚠️ **One field, deliberately.** The surface already answers *how may this document reach the server*,
 * which is the only ambient question any plugin has.
 */
export interface InnoventaMarkdownContext {
  readonly surface: MarkdownSurface
}

/**
 * A stable context for a surface.
 *
 * ⚠️ **Stability is a requirement, not a nicety.** Plugins memoise their per-context configuration — the
 * applet's evaluator among them — and an evaluator rebuilt on every render re-runs a debounced effect on
 * every render. Call sites that build a surface inline (`publicSurface(token)`) get a fresh object each
 * time, so they have to come through here.
 */
export function useMarkdownContext(surface: MarkdownSurface): InnoventaMarkdownContext {
  const identity = surfaceIdentity(surface)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ surface }), [identity])
}

/** Two surfaces with the same kind and tokens are the same surface. */
function surfaceIdentity(surface: MarkdownSurface): string {
  switch (surface.kind) {
    case "app":
      return "app"
    case "inert":
      return "inert"
    case "publicShare":
      return `share:${surface.shareToken}`
    case "publicKiwi":
      return `kiwi:${surface.address}`
  }
}

/**
 * How a document's `:::` directives are fetched.
 *
 * ⚠️ **Not the same type as the surface, even though they look alike.** A surface is a fact about the
 * screen; a resolution is an instruction to the data layer. Keeping them apart is what lets a new surface
 * be added without the hooks learning about screens.
 */
export type BlockResolution =
  | { readonly mode: "none" }
  | { readonly mode: "authenticated" }
  | { readonly mode: "publicShare"; readonly shareToken: string }
  | { readonly mode: "publicKiwi"; readonly address: string }

export function surfaceResolution(surface: MarkdownSurface): BlockResolution {
  switch (surface.kind) {
    case "app":
      return { mode: "authenticated" }
    case "publicShare":
      return { mode: "publicShare", shareToken: surface.shareToken }
    case "publicKiwi":
      return { mode: "publicKiwi", address: surface.address }
    case "inert":
      return { mode: "none" }
  }
}
