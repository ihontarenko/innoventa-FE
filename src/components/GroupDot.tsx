import type { CSSProperties } from "react"

/**
 * A small filled circle marking which group a row belongs to.
 *
 * ⚠️ **Reinforcement, never the only signal.** Red and green sit in the same palette because twelve
 * distinguishable hues cannot avoid them, so the group is always also readable as text beside the dot,
 * and the dot carries it as a tooltip. A list where colour is the only way to tell two families apart is
 * a list some readers cannot use at all.
 *
 * ⚠️ `hue` of `undefined` draws **nothing** rather than a grey circle — a dot for a group that was never
 * assigned a colour is a mark that means nothing, which is worse than no mark.
 */
export function GroupDot({ hue, label, size = 7 }: { hue: number | undefined; label?: string; size?: number }) {
  if (hue === undefined) {
    return null
  }

  return (
    <span
      title={label}
      aria-hidden={label === undefined}
      aria-label={label}
      className="inline-block shrink-0 rounded-full"
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          // Saturation and lightness are fixed here rather than passed: the whole point of the palette
          // is that one pair of them reads in every theme, and a caller free to change them is a caller
          // free to make one family invisible on a cream page.
          backgroundColor: `hsl(${hue} 62% 52%)`,
        } as CSSProperties
      }
    />
  )
}
