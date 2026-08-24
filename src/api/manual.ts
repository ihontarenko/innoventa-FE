import axios from "axios"

/**
 * The manual, as an anonymous visitor gets it (INVT-0111, INVT-0116).
 *
 * <h2>⚠️ Its own client, and it carries no token at all</h2>
 *
 * Not `api/http.ts` — that one attaches `innoventa.access` and refreshes it on a 401, which is exactly
 * wrong here: a visitor reading the manual has no account, and bouncing them into a sign-in because a
 * page 404'd would be absurd. Not `api/kiwiClient.ts` either — that one carries the reader's **Identity**
 * token and talks to Kiwi directly, which is the *signed-in* path.
 *
 * <h2>⚠️ These routes are Innoventa's own, and that is the architecture rather than a detour</h2>
 *
 * The pages live in Kiwi, but **Innoventa reads them as itself** — as a product holding `@CATEGORY`
 * grants — and serves the result from its own address (`KW-13`, `KW-1` §10). So the browser never talks
 * to Kiwi here, never needs a token, and never needs Kiwi to be reachable from wherever the visitor is.
 *
 * <p>⚠️ Which also means **what the manual contains is decided in Kiwi's access screen**, not here. Grant
 * the product a branch and it appears; take it back and it is gone on the next request. There is no
 * allowlist in this repository, and there must not be one.
 */
const manualClient = axios.create({
  baseURL: "/api/public/kiwi",
  // A visitor waiting on somebody else's outage should get a sentence, not a spinner.
  timeout: 8000,
})

/** One branch of the manual. ⚠️ Sections the product was not granted never appear — see the backend. */
export interface ManualSection {
  id: string
  name: string
  slug: string
  children: ManualSection[]
}

/** A page as the chapter index lists it — no document, deliberately. */
export interface ManualPageSummary {
  address: string
  title: string
  excerpt: string | null
}

/**
 * A page in full.
 *
 * ⚠️ **No author account, no Kiwi identifiers, no section id** — the backend strips them before this is
 * public. What is left is a document and two names.
 */
export interface ManualPage {
  address: string
  title: string
  contentMarkdown: string
  excerpt: string | null
  writtenBy: string | null
  lastEditedBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One edition of the manual — the same book in one language.
 *
 * ⚠️ **A translation is a separate tree, not a chapter.** Kiwi files each language under its own root,
 * which is right: they have different addresses, different histories and different grants. What was
 * wrong was drawing them side by side, as though the Ukrainian manual were part of the English one.
 */
export interface ManualEdition {
  /** A BCP-47 tag, and what `?language=` carries. */
  language: string
  /** ⚠️ Written in its own language — see the backend. */
  label: string
  /** The edition's root. ⚠️ A heading: its chapters are in `children`. */
  root: ManualSection
}

/**
 * The manual, as a book with editions.
 *
 * ⚠️ **Not every branch Innoventa was granted.** That is what this used to return, and it is why the
 * screen opened on a folder of calculators with no pages in it and showed a translation as a sibling
 * chapter. Which granted roots are the manual is an editorial decision the installation makes; the
 * grant still decides what may be shown at all.
 */
export function getManualEditions() {
  return manualClient.get<ManualEdition[]>("/manual").then((response) => response.data)
}

export function getManualPagesIn(sectionId: string) {
  return manualClient
    .get<ManualPageSummary[]>(`/sections/${sectionId}/pages`)
    .then((response) => response.data)
}

export function getManualPage(address: string) {
  return manualClient.get<ManualPage>(`/pages/${address}`).then((response) => response.data)
}

/**
 * Whether the manual could not be reached, as opposed to the page not being there.
 *
 * ⚠️ **503 is the backend's own word for "Kiwi is down"**, and it means the page probably exists and
 * cannot be shown right now. A 404 means there is nothing at this address for anybody. Telling a visitor
 * their bookmark is dead during an outage is the plausible lie this distinction exists to avoid.
 */
export function isManualUnavailable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  return !error.response || error.response.status >= 500
}

/** Every section flattened with its depth — what a sidebar indents. */
export function flattenManual(
  sections: ManualSection[],
  depth = 0,
): Array<{ section: ManualSection; depth: number }> {
  return sections.flatMap((section) => [
    { section, depth },
    ...flattenManual(section.children, depth + 1),
  ])
}

/**
 * Every section from the root down to this one, inclusive — empty where it is not in the tree.
 *
 * ⚠️ **A sidebar needs this because the section that is open is routinely not a root.** The manual's
 * chapters nest, and landing on a page files the reader into a descendant; drawing only that one leaves
 * every visible chapter collapsed and the reader apparently nowhere. What has to be expanded is the
 * whole path, and only the last of it is *current*.
 */
export function manualPathTo(sections: ManualSection[], sectionId: string | null): string[] {
  if (sectionId === null) {
    return []
  }

  for (const section of sections) {
    if (section.id === sectionId) {
      return [section.id]
    }

    const below = manualPathTo(section.children, sectionId)

    if (below.length > 0) {
      return [section.id, ...below]
    }
  }

  return []
}

/**
 * The document without the heading that merely repeats its title.
 *
 * ⚠️ **Because the page has a title field *and* the imported pages open with their own `# H1`** — they
 * were written as standalone documents inside Innoventa's old page store, where nothing above them drew
 * a name. Rendered under a heading here, every one of them says its own name twice.
 *
 * ⚠️ **Only when it is the same name, and only the first heading.** Anything else is the author's
 * structure: a page that opens on a genuinely different `# H1` keeps it, because that is a document
 * saying something rather than a duplicate. The comparison ignores case and surrounding space and
 * nothing else — a near-match is left alone, since guessing wrong deletes a line of somebody's page
 * from the reader's view.
 */
export function withoutRepeatedTitle(markdown: string, title: string): string {
  const match = markdown.match(/^\s*#\s+(.+?)\s*(\r?\n|$)/)

  if (!match || match[1].trim().toLowerCase() !== title.trim().toLowerCase()) {
    return markdown
  }

  return markdown.slice(match[0].length)
}

/**
 * Resolve the live-data directives in one manual page (INVT-0093).
 *
 * ⚠️ **The address goes up, the document does not.** Innoventa re-fetches that page from Kiwi itself,
 * as a granted product, and matches every requested directive against *that* text — so the allowlist is
 * never something the visitor sent. A client-supplied document would make it the visitor's to write,
 * which is exactly what the gate exists to prevent.
 *
 * ⚠️ Only `publicSafe()` directives answer here. Everything else comes back `RESTRICTED` — visibly,
 * never as silence, so a reader can tell "not for you" from "nothing there".
 */
export function resolveManualBlocks(address: string, blocks: Array<{ name: string; argument: string }>) {
  return manualClient.post(`/pages/${address}/blocks/resolve`, blocks)
}

/**
 * The reference shelf — Kiwi pages that are **not** the manual (INVT-0118).
 *
 * ⚠️ **Read through the same anonymous, republished path as the manual**, even though the screen that
 * shows it is behind a sign-in. The pages are reference material Innoventa already publishes to the
 * world; making a signed-in reader connect Identity to see a resistor formula would be asking for a
 * second identity to read something already public.
 *
 * ⚠️ **404 when nothing is configured**, and that is not an error state to shout about — an
 * installation with no reference branch simply has no shelf. The screen draws the tab away.
 */
export function getReferenceShelf() {
  return manualClient.get<ManualSection>("/reference").then((response) => response.data)
}
