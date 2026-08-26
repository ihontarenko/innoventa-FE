import { Textarea } from "@jmouse/ui"
import { EditorSection } from "../EditorSection"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * The expressions a value has to satisfy.
 *
 * ⚠️ **One per line, and the examples are on the page rather than behind a button.** They used to live
 * in a modal, which is the worst place for a reference somebody needs *while typing* — opening it
 * covers the box being typed into.
 */
const EXAMPLES: Array<{ expression: string; means: string }> = [
  { expression: "length(value) >= 3", means: "at least three characters" },
  { expression: "matches(value, '^[A-Z]{2}-\\\\d{4}$')", means: "two letters, a dash, four digits" },
  { expression: "number(value) between 1 and 100", means: "a number in a range" },
  { expression: "value in ['SMD', 'THT']", means: "one of a fixed set" },
]

export function ValidationSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, update } = editor

  return (
    <EditorSection title="Validation" icon="✓" badge={draft.validation.length || undefined} defaultOpen={false}>
      <Textarea
        rows={3}
        className="font-mono text-xs"
        placeholder="One expression per line"
        value={draft.validation.join("\n")}
        onChange={(event) => update({ validation: event.target.value.split("\n") })}
      />

      <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
        {EXAMPLES.map((example) => (
          <div key={example.expression} className="flex items-baseline gap-2 text-xs">
            <code className="font-mono">{example.expression}</code>
            <span className="text-muted-foreground">— {example.means}</span>
          </div>
        ))}
      </div>

      <span className="text-xs text-muted-foreground">
        ⚠️ Expressions are evaluated on the server; a blank line is ignored rather than saved.
      </span>
    </EditorSection>
  )
}
