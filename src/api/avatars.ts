/**
 * An account's face, in the shape all three products now share.
 *
 * ⚠️ **This replaced a URL.** Innoventa used to have one stable address per account —
 * `/_/avatar/{accountId}` — that the server answered for everybody, drawing an SVG when nothing had been
 * uploaded. The shared avatar has no server-drawn face: the interface reads `kind` and draws one of
 * three things.
 *
 * Two consequences worth knowing before somebody reports them as bugs:
 *
 * - **Replacing a picture produces a different URL**, because it is addressed by the stored object.
 *   That is the point: no cached copy anywhere can go stale.
 * - ⚠️ **A drawn face has no server-side address**, so it cannot be shown anywhere that cannot run
 *   JavaScript — mail and link previews reach an uploaded picture and nothing else.
 */
export type AvatarKind = "INITIALS" | "PRESET" | "UPLOAD"

export interface AvatarView {
  kind: AvatarKind
  /**
   * The descriptor a generated face is drawn from — **absent** unless `kind` is `PRESET`.
   *
   * ⚠️ A descriptor, not a bare seed: strategy, seed and that strategy's settings. A bare seed is still
   * valid forever and reads as the classic generator, so a value stored before this still draws the
   * face it always drew.
   *
   * ⚠️ Optional rather than nullable, because Innoventa omits nulls: an `INITIALS` avatar arrives as
   * `{"kind":"INITIALS"}` and nothing else. Testing `preset === null` is silently always false — the
   * value is `undefined`. **Test the kind**, which is the field that is always there.
   */
  preset?: string | null
  /** Where an uploaded picture's bytes are — **absent** unless `kind` is `UPLOAD`. */
  url?: string | null
}

/** The face of somebody who has never chosen one. */
export const drawnInitials: AvatarView = { kind: "INITIALS" }

/**
 * The image source for an avatar, or `null` when there is nothing to load.
 *
 * ⚠️ **`PRESET` has no source, and that is correct rather than missing.** A generated face is drawn in
 * the browser from its descriptor — there is nothing to fetch. `AccountAvatar` is what turns a seed into a
 * face; anything reaching for a URL wants that component instead.
 */
export function avatarSource(avatar: AvatarView | null | undefined): string | null {
  return (avatar?.kind === "UPLOAD" ? avatar.url : null) ?? null
}
