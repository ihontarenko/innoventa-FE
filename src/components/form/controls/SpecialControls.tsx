import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@jmouse/ui"
import type { ControlProperties } from "./types"

/**
 * The three that are neither text nor a list: `TAGS`, `COLOR`, `RATING`.
 */

/** The palette a colour field falls back to when it declares no swatches of its own. */
const DEFAULT_SWATCHES = ["#1E78A4", "#7A9070", "#9C7E4F", "#B6453E", "#B5832B", "#4D4D4C", "#2C5F26"]

/**
 * Free-form labels, comma-joined.
 *
 * ⚠️ **A tag is its own value** — there are no option rows behind it, which is why
 * `normalizeValueForUI` does not look tags up. Enter and comma both commit; backspace on an empty box
 * removes the last one, which is the behaviour anybody who has used a tag input expects and notices the
 * absence of.
 */
export function TagsControl({ value, onChange }: ControlProperties) {
  const [draft, setDraft] = useState("")
  const tags = value
    ? value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : []

  function addTag(raw: string) {
    const tag = raw.trim()

    // ⚠️ Silently ignored rather than warned about: adding a tag that is already there is not a
    // mistake worth a message, it is a no-op the reader can see for themselves.
    if (!tag || tags.includes(tag)) {
      setDraft("")
      return
    }

    onChange([...tags, tag].join(","))
    setDraft("")
  }

  function removeTag(tag: string) {
    onChange(tags.filter((candidate) => candidate !== tag).join(","))
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
            <X className="size-3 opacity-60 hover:opacity-100" />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        placeholder="Add tag…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            addTag(draft)
            return
          }

          if (event.key === "Backspace" && !draft && tags.length > 0) {
            removeTag(tags[tags.length - 1])
          }
        }}
        // Committing on blur is what stops a typed-but-uncommitted tag disappearing when somebody
        // clicks Save instead of pressing Enter.
        onBlur={() => {
          if (draft.trim()) {
            addTag(draft)
          }
        }}
      />
    </div>
  )
}

export function ColorControl({ field, value, onChange }: ControlProperties) {
  const swatches = field.options.length > 0 ? field.options.map((option) => option.optionValue) : DEFAULT_SWATCHES

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          aria-label={color}
          aria-pressed={value === color}
          className={cn(
            "size-6 rounded-full border-2 transition-transform",
            value === color ? "border-foreground scale-110" : "border-transparent",
          )}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}

      {/* The palette is a shortcut, not a limit — a field that offers swatches still accepts any
          colour, which is why the native picker sits beside them rather than instead of them. */}
      <input
        type="color"
        aria-label="Custom colour"
        title="Custom colour"
        className="size-6 cursor-pointer rounded-full border bg-transparent p-0"
        value={value || DEFAULT_SWATCHES[0]}
        onChange={(event) => onChange(event.target.value)}
      />

      {value && <span className="font-mono text-xs text-muted-foreground">{value}</span>}
    </div>
  )
}

export function RatingControl({ field, value, onChange }: ControlProperties) {
  const maximum = Number.parseInt(field.attributes["max"] ?? "5", 10)
  const current = Number.parseInt(value || "0", 10)

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maximum }, (_, index) => index + 1).map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          className={cn("text-lg leading-none transition-colors", star <= current ? "text-warning" : "text-ink-4")}
          // ⚠️ Clicking the current rating clears it. Without that, a rating field can be set once
          // and never unset — there is no other control for "no answer".
          onClick={() => onChange(star === current ? "0" : String(star))}
        >
          ★
        </button>
      ))}
      {current > 0 && (
        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
          {current}/{maximum}
        </span>
      )}
    </div>
  )
}
