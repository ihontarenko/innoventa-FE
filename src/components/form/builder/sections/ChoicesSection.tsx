import { useState } from "react"
import { ArrowDown, ArrowUp, Code2, Plus, Rows3, X } from "lucide-react"
import { Button, Input, Textarea, cn } from "@jmouse/ui"
import { OPTION_SOURCE_KEYS, STATIC_OPTION_SOURCE, parseOptions, serializeOptions } from "@/lib/fieldOptions"
import { OptionSourceEditor } from "../OptionSourceEditor"
import { EditorSection } from "../EditorSection"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * A field's choices — as rows, or as the one-line text the old editor had.
 *
 * ⚠️ **Both edit the same array.** The raw box is not a second store: it is parsed on every keystroke
 * into the very rows the table above would show, which is why switching between them cannot lose
 * anything and cannot disagree. It stays because pasting twenty units is genuinely faster than adding
 * twenty rows.
 */
export function ChoicesSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, update } = editor
  const [isRaw, setRaw] = useState(false)

  const isColour = draft.elementType === "COLOR"
  const source = draft.configs[OPTION_SOURCE_KEYS.SOURCE] || STATIC_OPTION_SOURCE
  const isStatic = source === STATIC_OPTION_SOURCE

  function setOptionAt(index: number, patch: Partial<{ value: string; label: string }>) {
    update({ options: draft.options.map((option, at) => (at === index ? { ...option, ...patch } : option)) })
  }

  function moveOption(index: number, direction: 1 | -1) {
    const target = index + direction

    if (target < 0 || target >= draft.options.length) {
      return
    }

    const options = [...draft.options]
    ;[options[index], options[target]] = [options[target], options[index]]
    update({ options })
  }

  return (
    <EditorSection
      title={isColour ? "Swatches" : "Choices"}
      icon={isColour ? "◐" : "▾"}
      badge={isStatic ? draft.options.length : source}
      hint={isColour ? undefined : isStatic ? undefined : "drawn by a provider"}
    >
      {/* ⚠️ COLOR has no provider to pick: a swatch list is always typed in, and a dropdown with one
          option is a control that only teaches the reader it does nothing. */}
      {!isColour && <OptionSourceEditor editor={editor} />}

      {isStatic || isColour ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isColour ? "Hex value, and what to call it" : "Stored value, and what the reader sees"}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRaw((previous) => !previous)}>
              {isRaw ? <Rows3 className="size-3.5" /> : <Code2 className="size-3.5" />}
              {isRaw ? "rows" : "raw"}
            </Button>
          </div>

          {/* ⚠️ Capped rather than stretched. This card spans the full width of the editor, and a label
              box a thousand pixels wide for `±5%` makes a list of seven choices unreadable — the eye has
              to travel the whole line to pair a value with its label. */}
          {isRaw ? (
            <Textarea
              rows={4}
              className="max-w-3xl font-mono text-xs"
              placeholder={isColour ? "#FF0000:Red, #00AA00:Green" : "pF:picoFarads, nF:nanoFarads"}
              value={serializeOptions(draft.options)}
              onChange={(event) => update({ options: parseOptions(event.target.value) })}
            />
          ) : (
            <div className="flex max-w-3xl flex-col gap-1">
              {draft.options.map((option, index) => (
                <div key={index} className="flex items-center gap-1">
                  {isColour && (
                    <span
                      aria-hidden="true"
                      className="size-6 shrink-0 rounded-full border"
                      style={{ background: option.value }}
                    />
                  )}
                  <Input
                    aria-label="Value"
                    className={cn("w-32 shrink-0 font-mono text-xs")}
                    value={option.value}
                    onChange={(event) => setOptionAt(index, { value: event.target.value })}
                  />
                  <Input
                    aria-label="Label"
                    className="text-xs"
                    placeholder={option.value}
                    value={option.label}
                    onChange={(event) => setOptionAt(index, { label: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveOption(index, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Move down"
                    disabled={index === draft.options.length - 1}
                    onClick={() => moveOption(index, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    onClick={() => update({ options: draft.options.filter((_, at) => at !== index) })}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => update({ options: [...draft.options, { value: "", label: "" }] })}
              >
                <Plus className="size-3.5" />
                Add {isColour ? "swatch" : "choice"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          The rows below are not used while a provider is set — it draws the choices.
        </span>
      )}
    </EditorSection>
  )
}
