import { Textarea } from "@jmouse/ui"
import { EditorSection } from "../EditorSection"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * The checks a value has to satisfy wherever this field is used.
 *
 * ## ⚠️ This is the FIELD's half, and it stays editable
 *
 * A record is judged by three things, in order: the field's `required` flag, the checks written here,
 * and then the form's own validation document. It was tempting to make this read-only once forms got
 * documents — two editors for one thing is the classic way to lose an edit — but they are not one
 * thing. What is written here travels **with the field, into every form that uses it**: `quantity`
 * carries one rule for forty-four forms, so a form's document could not express it without saying it
 * forty-four times.
 *
 * So the heading says *Field checks*, not *Validation*: the word Validation now names the button on
 * the form, and the two must not read as the same screen reached twice.
 *
 * ⚠️ **A check is a constraint definition, not a boolean expression.** The grammar is
 * `@Name('key':value, …)` — one per line — and the names come from a registry, so a check that is not
 * registered does not fail loudly, it simply never runs. That is why the examples below are the whole
 * registered vocabulary rather than a flavour of it: there is nothing else to write.
 *
 * ⚠️ **The examples are on the page rather than behind a button.** They used to live in a modal, which
 * is the worst place for a reference somebody needs *while typing* — opening it covers the box being
 * typed into.
 */
const EXAMPLES: Array<{ expression: string; means: string }> = [
  { expression: "@Required('message':'A part number is needed')", means: "must be present" },
  { expression: "@NotBlank('message':'Not just spaces')", means: "must not be blank" },
  { expression: "@MinMax('mode':'min','min':0,'message':'0 or more')", means: "a lower bound" },
  { expression: "@MinMax('mode':'range','min':1,'max':100,'message':'1 to 100')", means: "a number in a range" },
  { expression: "@OneOf('allowed':['SMD','THT'],'message':'SMD or THT')", means: "one of a fixed set" },
  { expression: "@Size('min':3,'max':64,'message':'3 to 64 characters')", means: "a length in a range" },
  // ⚠️ One backslash on the screen, so `\\d` in the source. A reference somebody copies from has to
  // show the characters they must type, and a doubled one is a regex that matches a literal backslash.
  { expression: "@Pattern('regex':'^[A-Z]{2}-\\d+$','message':'Like AB-12')", means: "a shape" },
  { expression: "@Email('message':'Not an address')", means: "an email address" },
  { expression: "@WebLink('host':'mouser.com','message':'A Mouser link')", means: "a web address" },
  { expression: "@NotBlank('message':field.label ~ ' is needed')", means: "the message is an expression too" },
]

export function ValidationSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, update } = editor

  return (
    <EditorSection title="Field checks" icon="✓" badge={draft.validation.length || undefined} defaultOpen={false}>
      <Textarea
        rows={3}
        // ⚠️ Ligatures off: JetBrains Mono draws `>=` as `≥`, and a reference somebody copies from has
        // to show the characters they must type.
        className="font-mono text-xs [font-variant-ligatures:none]"
        placeholder="@Required('message':'…') — one check per line"
        value={draft.validation.join("\n")}
        onChange={(event) => update({ validation: event.target.value.split("\n") })}
      />

      <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2 [font-variant-ligatures:none]">
        {EXAMPLES.map((example) => (
          <div key={example.expression} className="flex items-baseline gap-2 text-xs">
            <code className="font-mono">{example.expression}</code>
            <span className="text-muted-foreground">— {example.means}</span>
          </div>
        ))}
      </div>

      <span className="text-xs text-muted-foreground">
        These travel with the field, into every form that uses it. What one form asks on top of them is
        its own document, behind <strong>Validation</strong> on the form.
      </span>

      <span className="text-xs text-muted-foreground">
        ⚠️ Checks run on the server; a blank line is ignored rather than saved. A name outside the
        registered ones saves fine here and then rejects every entry submitted to the form — check the
        spelling.
      </span>
    </EditorSection>
  )
}
