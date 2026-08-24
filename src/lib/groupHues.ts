/**
 * Twelve hues, far enough apart that two of them side by side are two colours.
 *
 * ⚠️ **Fixed saturation and lightness, and mid-lightness is the reason one palette serves all 29
 * themes**: a dot at 52% reads against a cream page and against an obsidian one, where anything tuned
 * for either disappears into the other.
 */
const GROUP_HUES = [212, 12, 148, 40, 278, 186, 96, 322, 252, 64, 168, 300]

/**
 * One colour per group, assigned **by position** rather than by hashing the name.
 *
 * ⚠️ **Hashing is the obvious way and it is the wrong one here.** Ten groups drawn from a palette of
 * twelve collide more often than not, and a collision is not cosmetic — it is two unrelated families
 * wearing the same badge on a screen whose only claim is that the badge means family. Handing them out
 * in order cannot collide until there are more groups than colours, and neighbours are then guaranteed
 * to differ because consecutive entries above are deliberately far apart.
 *
 * Pass the groups in the order they are drawn, so the colours run down the list rather than jumping
 * about; repeats are ignored, so a caller can simply map over its rows.
 */
export function groupHues(groups: Iterable<string>): Map<string, number> {
  const assigned = new Map<string, number>()

  for (const group of groups) {
    if (!assigned.has(group)) {
      assigned.set(group, GROUP_HUES[assigned.size % GROUP_HUES.length])
    }
  }

  return assigned
}
