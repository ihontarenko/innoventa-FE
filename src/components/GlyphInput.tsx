import { EmojiPickerButton, Input, cn } from "@jmouse/ui"

/**
 * The one-character mark a form, a field, a purpose or a heading leads with — typed, or picked.
 *
 * <h2>⚠️ Both halves, because this field is not emoji-only</h2>
 *
 * <p>Four screens had the identical control: a two-character input with an emoji in its placeholder and
 * a comment saying *one character or one emoji*. The letter case is real — `◫` and a bare initial are
 * both used here — so replacing it with `@jmouse/ui`'s picker outright would have quietly removed
 * something people use. The picker is therefore docked to it rather than substituted for it: type a
 * character, or press the square and search a thousand emoji by tag.
 *
 * <p>⚠️ **`maxLength` is deliberately not two any more.** Two was already wrong — a flag is two
 * regional indicators and a family is eleven characters, so the old field silently truncated exactly the
 * emoji somebody had gone to the trouble of pasting. The cap is the column's, and what makes it *one*
 * glyph rather than several is the picker on the right for an emoji and self-restraint for a letter.
 */
export function GlyphInput({
  value,
  onChange,
  placeholder = "◫",
  disabled = false,
  autoFocus = false,
  className,
  id,
}: {
  value: string
  onChange: (glyph: string) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  id?: string
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        id={id}
        className="h-8 w-12 text-center text-sm"
        maxLength={16}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />

      <EmojiPickerButton
        size="sm"
        value={value}
        disabled={disabled}
        // ⚠️ Empty rather than null: every caller here holds a string, and no glyph is a blank field.
        onChange={(chosen) => onChange(chosen ?? "")}
        recentStorageKey="innoventa.emoji.recent"
        labels={{ open: "Pick an emoji", clear: "No glyph" }}
        // ⚠️ The square is the picker's HANDLE, not a second display of the value: the input beside it
        // already shows what is set, and two copies of one character read as a rendering fault. The
        // value still goes in — it is what marks the current emoji inside the grid.
        showValue={false}
      />
    </div>
  )
}
