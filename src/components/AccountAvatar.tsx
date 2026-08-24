import type { ComponentProps } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@jmouse/ui"
import { Avatar as GeneratedAvatar } from "@jmouse/avatars/picker"
import type { AvatarView } from "@/api/avatars"

interface AccountAvatarProperties extends ComponentProps<typeof Avatar> {
  account?: {
    displayName?: string | null
    email?: string | null
    avatar?: AvatarView | null
  } | null
}

/**
 * An account's face — whichever of the three kinds it wears.
 *
 * ⚠️ **The one place that knows an avatar has kinds.** Everything else renders a person by rendering
 * this; adding a fourth kind is a case added here and nothing else touched. It is deliberately shaped
 * like `Avatar` itself (same props, same sizes) so a screen wanting a bare face still gets the ring,
 * the group offsets and the sizing behaviour.
 *
 * `avatar` is optional rather than required because a payload written before this existed — or a
 * partial account assembled locally — should render initials rather than crash. Initials are also what
 * an upload falls back to while its image is still in flight, which Radix handles: `AvatarImage` yields
 * to the fallback until the bytes decode.
 */
export function AccountAvatar({ account, ...properties }: AccountAvatarProperties) {
  const avatar = account?.avatar

  return (
    <Avatar {...properties}>
      {avatar?.kind === "UPLOAD" && avatar.url && (
        <AvatarImage src={avatar.url} alt={accountName(account)} />
      )}

      {avatar?.kind === "PRESET" && avatar.preset ? (
        <GeneratedAvatar source={avatar.preset} size={null} className="block size-full [&>svg]:size-full" />
      ) : (
        <AvatarFallback className="text-[11px]">{accountInitials(account)}</AvatarFallback>
      )}
    </Avatar>
  )
}

/** What to call somebody when the interface has to write their name. */
export function accountName(account?: { displayName?: string | null; email?: string | null } | null) {
  return account?.displayName?.trim() || account?.email?.trim() || "Somebody"
}

/**
 * The letters drawn when there is no face.
 *
 * ⚠️ Taken from the display name where there is one and from the email otherwise — never from the id,
 * which is a UUID and draws two characters of noise.
 */
export function accountInitials(account?: { displayName?: string | null; email?: string | null } | null) {
  const source = account?.displayName?.trim() || account?.email?.trim() || ""
  const words = source.split(/[\s@._-]+/).filter(Boolean)

  if (words.length === 0) {
    return "?"
  }

  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}
