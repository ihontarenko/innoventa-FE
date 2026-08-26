/**
 * Which row of a menu the current address counts as being on.
 *
 * ⚠️ **Its own module because three menus ask it.** The platform menu, a workspace's served menu and a
 * screen's menu each draw one row as active, and each deriving its own answer is how two of them come
 * to light up at once — which reads as a broken menu rather than as a nested place.
 */

export function isItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

/**
 * The one entry the current location counts as being on.
 *
 * ⚠️ **One winner, not a predicate per row.** `/admin/access` is described by both the Administration
 * screen (`/admin`) and Access control, and two highlighted rows read as a broken menu. Longest path
 * wins, so a nested address can never be outranked by the screen it sits inside.
 */
export function activePath(paths: string[], pathname: string): string | null {
  return (
    paths
      .filter((path) => isItemActive(pathname, path))
      .sort((first, second) => second.length - first.length)
      .at(0) ?? null
  )
}
