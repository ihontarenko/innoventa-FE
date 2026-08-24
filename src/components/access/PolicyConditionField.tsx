import { useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete"
import { EditorView } from "@codemirror/view"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@jmouse/ui"
import { jMouseEL } from "@/lib/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import type { PolicyVocabularyView } from "@/api/policy"

/**
 * The sixth axis, edited where there is room to read it.
 *
 * ⚠️ **Why a button and not a text box.** A condition is the one part of a grant that is a *program*:
 * `action == 'entry.listByPurpose' and purposeCode in ['inventory']` is ninety characters of jMouse-EL,
 * and it sat in the fifth column of a five-column row, about a hundred and forty pixels wide, in a font
 * with no syntax colour. It could be typed into and never read back — the worst possible shape for the
 * one field that can make a permission held on one row and refused on the next.
 *
 * So the row shows what the rule *says*, and opening it gives the whole dialog width to a real editor.
 *
 * ⚠️ **Nothing here validates.** The real parser runs on the document as a whole, on the server, and
 * reports through the problems band above — a second opinion in the browser about whether an expression
 * is well formed is a second grammar that agrees for a month.
 */
export function PolicyConditionField({
  condition,
  vocabulary,
  disabled,
  onChange,
}: {
  condition: string | null
  vocabulary?: PolicyVocabularyView
  disabled: boolean
  onChange: (condition: string | null) => void
}) {
  const [isOpen, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={condition ?? "This grant applies to every call. Open to narrow it."}
        className={cn(
          "max-w-56 truncate rounded border px-1.5 py-1 text-left font-mono text-[11px]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          condition ? "border-warning/40 bg-warning/10 text-warning" : "text-muted-foreground hover:bg-accent",
        )}
      >
        {condition ?? "when …"}
      </button>

      {isOpen && (
        <PolicyConditionDialog
          condition={condition}
          vocabulary={vocabulary}
          readOnly={disabled}
          onClose={() => setOpen(false)}
          onApply={onChange}
        />
      )}
    </>
  )
}

/**
 * The editor itself.
 *
 * ⚠️ The draft is local until Apply, like every other editor in this cluster: each change to the
 * document is a round trip to the server's writer, so editing in place would be a request per keystroke.
 */
function PolicyConditionDialog({
  condition,
  vocabulary,
  readOnly,
  onClose,
  onApply,
}: {
  condition: string | null
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onClose: () => void
  onApply: (condition: string | null) => void
}) {
  const [draft, setDraft] = useState(condition ?? "")

  const codeThemeExtensions = useCodeThemeExtensions()

  const extensions = useMemo(
    () => [
      jMouseEL(),
      ...codeThemeExtensions,
      EditorView.lineWrapping,
      autocompletion({ override: [(context) => complete(context, vocabulary)] }),
    ],
    [vocabulary, codeThemeExtensions],
  )

  /** Blank clears the rule rather than storing an empty one — an empty `when` is a parse error. */
  function apply() {
    onApply(draft.trim() === "" ? null : draft.trim())
    onClose()
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] sm:max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>When does this apply?</DialogTitle>
          <DialogDescription>
            Written in <strong>jMouse-EL</strong>, the same language a form field's validation rule uses. It is asked
            once per decision and narrows this grant to the calls it answers true for — leave it empty and the grant
            applies to every call.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-24 overflow-hidden rounded-md border">
          <CodeMirror
            value={draft}
            editable={!readOnly}
            theme="none"
            autoFocus
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              autocompletion: false,
              bracketMatching: true,
            }}
            extensions={extensions}
            onChange={setDraft}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <Vocabulary vocabulary={vocabulary} onInsert={(word) => setDraft(draft === "" ? word : `${draft} ${word}`)} />
        </div>

        <DialogFooter className="sm:justify-start">
          {!readOnly && condition && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onApply(null)
                onClose()
              }}
            >
              Clear the rule
            </Button>
          )}

          <div className="flex-1" />

          <Button variant="outline" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && <Button onClick={apply}>Apply</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Every word this expression may legally read, listed rather than remembered.
 *
 * ⚠️ **An action and the values it carries are one fact, and are shown as one.** Naming an action on
 * its own lets somebody write `action == 'entry.listByPurpose'` and then guess at what may be compared
 * beside it — and a guess that names a real value published by a *different* action produces a rule
 * that never fires and says nothing about why. What refuses that pairing is the binder, at save and at
 * boot; what makes it unlikely is showing the pair.
 *
 * A **variable** is readable under any action or none, which is why it is a separate list and not
 * folded into every action's.
 */
function Vocabulary({
  vocabulary,
  onInsert,
}: {
  vocabulary?: PolicyVocabularyView
  onInsert: (word: string) => void
}) {
  if (!vocabulary) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <WordGroup heading="Actions" count={vocabulary.actions.length}>
        {vocabulary.actions.map((action) => (
          <Word
            key={action.name}
            title={[
              action.description ?? "Declared by a route, and not yet by the policy file",
              action.values.length > 0
                ? `produces ${action.values.join(", ")}`
                : "produces nothing — scope a rule to it, and compare nothing else",
            ].join("\n")}
            onInsert={() => onInsert(`action == '${action.name}'`)}
          >
            {action.name}
          </Word>
        ))}
      </WordGroup>

      <WordGroup heading="Variables" count={vocabulary.variables.length}>
        {vocabulary.variables.map((variable) => (
          <Word
            key={variable.name}
            title={[
              variable.description ?? "Attached to every call, and not yet in the policy file",
              variable.kind === "DYNAMIC"
                ? "worked out from the call being decided — two requests may see two answers"
                : "settled before any call arrives — the same for every decision",
            ].join("\n")}
            onInsert={() => onInsert(variable.name)}
          >
            {variable.name}
          </Word>
        ))}
      </WordGroup>
    </div>
  )
}

function WordGroup({ heading, count, children }: { heading: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">{heading}</span>
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  )
}

function Word({
  title,
  onInsert,
  children,
}: {
  title: string
  onInsert: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onInsert}
      className="rounded border px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
    >
      {children}
    </button>
  )
}

/**
 * Completion inside the expression — the same catalogues the pickers beside it read.
 *
 * Two positions, because two are all a condition has: inside the quotes after `action ==`, and anywhere
 * else, where a variable or a value an action produces may be named.
 */
function complete(context: CompletionContext, vocabulary?: PolicyVocabularyView): CompletionResult | null {
  if (!vocabulary) {
    return null
  }

  const action = context.matchBefore(/action\s*[!=]=\s*'[\w.]*/)

  if (action) {
    return {
      from: action.from + action.text.lastIndexOf("'") + 1,
      options: vocabulary.actions.map((published) => ({
        label: published.name,
        type: "property",
        detail: published.description ?? "declared by a route, and not yet by the policy file",
      })),
    }
  }

  const word = context.matchBefore(/[\w.]+/)

  if (!word && !context.explicit) {
    return null
  }

  const produced = new Set<string>()

  for (const published of vocabulary.actions) {
    published.values.forEach((value) => produced.add(value))
  }

  return {
    from: word ? word.from : context.pos,
    options: [
      ...vocabulary.variables.map((variable) => ({
        label: variable.name,
        type: "variable",
        detail: variable.description ?? "attached to every call",
      })),
      ...[...produced].sort().map((value) => ({
        label: value,
        type: "variable",
        detail: "a value an action produces — readable in a rule scoped to that action",
      })),
      { label: "action", type: "keyword", detail: "what the call is doing" },
    ],
  }
}
