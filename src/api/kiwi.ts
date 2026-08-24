import { kiwiClient } from "@/api/kiwiClient"

/**
 * What Innoventa reads and writes in **Kiwi** (KW-10; INVT-0097).
 *
 * ⚠️ **Nothing in a payload identifies a person except an Identity subject and a display name**
 * (KW-1 §9). Kiwi has its own `members` table with its own avatars and Innoventa has its own; whoever
 * renders draws the face it knows. So a page's author arrives as a subject, and **Innoventa maps it to
 * its own member row** — never rendering a Kiwi avatar, or one person wears two faces on one screen.
 *
 * ⚠️ **There is no section management here, and that is the shape rather than an omission.** Kiwi owns
 * its tree: creating, renaming, moving and deleting a section happen on Kiwi's own screens, where the
 * grants that govern them are visible. A consumer that offered those controls would be offering
 * somebody a button whose refusal it cannot explain.
 */

/**
 * One section of Kiwi's tree and everything under it.
 *
 * ⚠️ **`readable: false` is a breadcrumb.** It is an ancestor of a branch this reader was granted,
 * carried so the tree has a path down to it (KW-1 §4) — with no slug, no count and none of its own
 * contents. Do not build a link from one, and do not read its zero as information.
 */
export interface KiwiCategoryNode {
  id: string
  name: string
  slug: string | null
  sortOrder: number
  itemCount: number
  readable: boolean
  children: KiwiCategoryNode[]
}

/** A person, as every Kiwi payload names one — the subject is the only identifier both products share. */
export interface KiwiMember {
  id: string
  subject: string
  displayName: string | null
  email: string | null
}

export interface KiwiPageSummary {
  id: string
  /**
   * ⚠️ **The half of a page's identity that never moves** (KW-0093) — six random characters, drawn once.
   * What a short link and a cross-product reference should point at.
   */
  hash: string
  /**
   * ⚠️ **What a link to it READS as, and it can be changed.** This used to be permanent (KW-1 §7), which
   * meant it was stuck at whatever the page was called before anybody had named it. Every address a page
   * has ever had goes on resolving, so this is the field to *show* and `hash` is the field to *store*.
   */
  address: string
  title: string
  excerpt: string | null
  categoryId: string
  author: KiwiMember | null
  updatedBy: KiwiMember | null
  createdAt: string
  updatedAt: string
}

export interface KiwiPageDetail extends KiwiPageSummary {
  contentMarkdown: string | null
  /** ⚠️ Never zero: Kiwi writes a revision on every save from the first one (KW-1 §6). */
  revisionCount: number
  /** What this document's relative links resolve against — see {@link resolveKiwiAssets}. */
  assetBase: string | null
}

/**
 * Make a Kiwi page's links resolve **against Kiwi** (TSSR-0101).
 *
 * <h2>⚠️ Why a document needs this at all</h2>
 *
 * Kiwi stores images and attachments as **root-relative** paths — `![a dot](/api/public/files/…)`. On
 * Kiwi's own screens that is right and survives any deployment. Rendered here it is a lie: the browser
 * resolves it against **Innoventa's** origin, which has no such route, and every picture on every page is
 * a broken image. That is exactly what the first real page drawn in the wiki tab looked like.
 *
 * <h2>⚠️ The base comes from Kiwi, not from a constant here</h2>
 *
 * Two consumers each keeping their own copy of Kiwi's address is two places to get it wrong, and the
 * second one to get it slightly wrong is the one nobody notices. So `assetBase` travels on the payload
 * with the markdown that needs it.
 *
 * <h2>⚠️ ONLY `/api/public/files/…`, and the narrowness is the whole correctness</h2>
 *
 * The first version of this rewrote **every** root-relative link, and it was wrong in a way the imported
 * manual demonstrates on its second page: it contains `[Innoventa landing page](/)`. That link means
 * *Innoventa's* landing page — the document was written inside Innoventa and its own links point there.
 * A blanket rewrite would have silently redirected it to Kiwi's root.
 *
 * So the rule is not "relative links belong to Kiwi". It is: **the file route is Kiwi's, and nothing
 * else in the document can be assumed to be.** `/api/public/files/{id}` is written by Kiwi's own editor
 * when somebody inserts a picture, which is exactly why it can be recognised and exactly why nothing
 * else can.
 *
 * <h2>⚠️ What it therefore leaves alone</h2>
 *
 * Every other link: absolute URLs, `mailto:`, anchors, page-relative paths, **and any other
 * root-relative path**, which belongs to whichever product the author had in mind. Also raw
 * `<img src="/…">` — a looser expression would eventually rewrite a path shown as an example inside a
 * code fence, silently editing a document that was explaining something.
 */
export function resolveKiwiAssets(markdown: string | null, assetBase: string | null): string {
  if (!markdown || !assetBase) {
    return markdown ?? ""
  }

  const base = assetBase.replace(/\/+$/, "")

  return markdown.split("](/api/public/files/").join(`](${base}/api/public/files/`)
}

/**
 * Put it back the way Kiwi stores it, before saving.
 *
 * <h2>⚠️ This is not tidiness — without it the rewrite corrupts the document</h2>
 *
 * `MarkdownField` is an **editor**: whatever it was given is what comes back out of `onCommit`. Hand it
 * the resolved text and the next save writes **Innoventa's view of Kiwi's address** into Kiwi's own
 * database — permanently, for every reader, including Kiwi's own screens. That is exactly the failure
 * TSSR-0101 rejected storing absolute URLs to avoid, arrived at from the other side.
 *
 * <p>So the pair is symmetric and must stay symmetric: resolve on the way in, unresolve on the way out.
 * ⚠️ A future editor that saves without passing through here reintroduces the bug silently — the page
 * looks right in both products until somebody moves Kiwi.
 *
 * <p>⚠️ It strips **only this base**. A link somebody deliberately wrote as an absolute URL to Kiwi —
 * because they meant it to survive being copied elsewhere — is indistinguishable from a rewritten one,
 * and is therefore also stripped. That is the known cost, and it is smaller than the alternative:
 * leaving a rewritten link absolute forever.
 */
export function unresolveKiwiAssets(markdown: string, assetBase: string | null): string {
  if (!assetBase) {
    return markdown
  }

  const base = assetBase.replace(/\/+$/, "")

  return markdown.split(`](${base}/api/public/files/`).join("](/api/public/files/")
}

export function getKiwiTree() {
  return kiwiClient.get<KiwiCategoryNode[]>("/categories").then((response) => response.data)
}

export function getKiwiPagesIn(categoryId: string) {
  return kiwiClient
    .get<KiwiPageSummary[]>(`/categories/${categoryId}/pages`)
    .then((response) => response.data)
}

export function getKiwiPage(pageId: string) {
  return kiwiClient.get<KiwiPageDetail>(`/pages/${pageId}`).then((response) => response.data)
}

export function createKiwiPage(categoryId: string, title: string, contentMarkdown: string) {
  return kiwiClient
    .post<KiwiPageDetail>(`/categories/${categoryId}/pages`, { title, contentMarkdown })
    .then((response) => response.data)
}

export function updateKiwiPage(pageId: string, title: string, contentMarkdown: string) {
  return kiwiClient
    .put<KiwiPageDetail>(`/pages/${pageId}`, { title, contentMarkdown })
    .then((response) => response.data)
}

/** Re-file a page into another section. ⚠️ The address does not change with it (KW-1 §7). */
export function fileKiwiPage(pageId: string, categoryId: string) {
  return kiwiClient
    .put<KiwiPageDetail>(`/pages/${pageId}/category`, { categoryId })
    .then((response) => response.data)
}

/**
 * ⚠️ **Not the same permanence Innoventa's own pages had.** Kiwi keeps a revision per save, so a deleted
 * page is a deleted history rather than a deleted paragraph — worth saying on the screen, and the
 * screen does.
 */
export function deleteKiwiPage(pageId: string) {
  return kiwiClient.delete<void>(`/pages/${pageId}`).then(() => undefined)
}

/**
 * Search, across everything this reader may see (KW-16).
 *
 * ⚠️ **It spans Kiwi's whole tree, not a project's branch** — there is nowhere in the request to say
 * "only under here", because a search has no place to declare and Kiwi resolves the readable set from
 * the caller's own grants. Narrowing to a project's root is therefore the *caller's* job, and
 * {@link isInsideSubtree} is how this screen does it.
 *
 * ⚠️ **An empty query answers with an empty list**, not with everything — so this is never a way to
 * list a section's pages. That is {@link getKiwiPagesIn}.
 */
export function searchKiwiPages(query: string) {
  return kiwiClient
    .get<KiwiPageSummary[]>("/pages", { params: { query } })
    .then((response) => response.data)
}

/**
 * Every section of the tree, flattened with its depth — what a picker offers and what a sidebar
 * indents.
 *
 * ⚠️ Derived here rather than asked for: Kiwi sends the tree nested because that is the shape that
 * cannot be drawn wrong, and a flat list with a depth is what a `<select>` needs.
 */
export function flattenKiwiTree(
  nodes: KiwiCategoryNode[],
  depth = 0,
): Array<{ node: KiwiCategoryNode; depth: number }> {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenKiwiTree(node.children, depth + 1)])
}

/** The node with this identifier, anywhere in the tree, or null where the reader cannot see it. */
export function findKiwiSection(nodes: KiwiCategoryNode[], categoryId: string): KiwiCategoryNode | null {
  for (const node of nodes) {
    if (node.id === categoryId) {
      return node
    }

    const found = findKiwiSection(node.children, categoryId)

    if (found !== null) {
      return found
    }
  }

  return null
}

/**
 * Whether a section identifier is this subtree's own or one of its descendants'.
 *
 * ⚠️ Used to keep a whole-tree search inside a project's branch. A page filed elsewhere in Kiwi is not
 * this project's wiki even when the same person may read both — showing it here would quietly make the
 * project's root setting decorative.
 */
export function isInsideSubtree(root: KiwiCategoryNode, categoryId: string): boolean {
  return findKiwiSection([root], categoryId) !== null
}
