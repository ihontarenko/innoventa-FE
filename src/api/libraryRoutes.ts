/**
 * Where the jMouse libraries answer — the interface's single copy of the addresses.
 *
 * ## ⚠️ One root, one rule, one file
 *
 * Every library surface lives under `/jmouse/<namespace>/api` (Ivan, 2026-08-25: *«нехай всі
 * бібліотечні будуть уніфіковані типу /jmouse/…»*). Before this, each library had been given a bespoke
 * address per product — `/jmouse-files/api` here, `/jmai/api` there, `/api/query` for a third — and the
 * costs were real rather than aesthetic: a proxy rule per library in every interface, a matcher per
 * library in every security configuration, and three products that agreed only by luck.
 *
 * ## ⚠️ This file exists because the address used to live in three unchecked places
 *
 * The backend property, the Vite proxy entry and the client below are three copies of one string, and
 * nothing compares them. When they drift **every call 404s and no screen raises an error** — the file
 * manager reads as an account with no files, the AI screens as an installation with no providers. Both
 * happened. The proxy now needs one rule for `/jmouse` and never another; this file is the interface's
 * only copy of what hangs off it.
 *
 * ⚠️ **The backend composes these itself and nothing is configured there.** A product that sets
 * `jmouse.<namespace>.management.prefix` moves one library out from under this file — which is exactly
 * what stopped being allowed.
 */
export const JMOUSE_ROOT = "/jmouse"

export const LIBRARY_ROUTES = {
  /** `jmouse-storage-management` — files and the directory tree. */
  files: `${JMOUSE_ROOT}/files/api`,
  /** `jmouse-ai-management` — providers, assistants, agents, connections. */
  ai: `${JMOUSE_ROOT}/ai/api`,
  /** `jmouse-query-spring-boot` — the filter builder, saved views and source declarations. */
  query: `${JMOUSE_ROOT}/query/api`,
  /** `jmouse-mapper-management` — the `.jmm` builder: the type catalogue, and rows ⇄ document. */
  mapper: `${JMOUSE_ROOT}/mapper/api`,
  /**
   * `jmouse-liveblocks` — the directives another product's document embeds.
   *
   * ⚠️ **Fixed in the library, not configurable.** A consumer holds a namespace and an origin and
   * appends this path; a product able to move it would need a second field in every consumer.
   */
  blocks: `${JMOUSE_ROOT}/blocks/api`,
} as const
