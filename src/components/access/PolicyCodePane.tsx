import { useMemo } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint"
import { EditorView } from "@codemirror/view"
import { policyApi } from "@/api/policy"
import type { PolicyProblemStage } from "@/api/policy"
import { jmpSyntax } from "@/lib/codemirror"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"

/**
 * The policy as text, linted by the thing that actually decides.
 *
 * ⚠️ **The browser never decides whether a policy is valid.** The linter below calls
 * `POST /policy/validate`, which runs the real parser and the real binder; the grammar in
 * `@jmouse/codemirror` only **colours**. A TypeScript re-implementation of the grammar would
 * be a second grammar that agrees for about a month — after which the editor calls a file good and the
 * boot refuses it, or, worse, the other way round.
 *
 * ⚠️ **CodeMirror debounces the linter itself**, which is why this asks the API directly rather than
 * going through a mutation: the linter wants a promise per settled edit, and a mutation would put one
 * cache entry per keystroke behind it.
 */

/** Three stages, three different next moves — so the reader is told which one refused. */
const STAGE_WORDS: Record<PolicyProblemStage, string> = {
  PARSE: "syntax",
  BIND: "binding",
  GUARD: "guard",
}

export function PolicyCodePane({
  source,
  onChange,
  readOnly = false,
}: {
  source: string
  onChange?: (next: string) => void
  readOnly?: boolean
}) {
  const codeThemeExtensions = useCodeThemeExtensions()

  // ⚠️ Built once: a linter recreated on every render restarts CodeMirror's debounce, so a document
  // being typed into is validated on the first keystroke and never again until typing stops entirely.
  const policyLinter = useMemo(
    () =>
      linter(async (view): Promise<Diagnostic[]> => {
      const text = view.state.doc.toString()

      if (!text.trim()) {
        return []
      }

      try {
        const { data } = await policyApi.validate(text)

        return data.problems.map((problem) => {
          // ⚠️ `line` is 0 where the complaint is about the document as a whole — anchored to the very
          // start rather than dropped, because a problem with nowhere to point is still a problem.
          const line = problem.line > 0 ? view.state.doc.line(Math.min(problem.line, view.state.doc.lines)) : null
          const from = line ? line.from + Math.max(0, problem.column - 1) : 0

          return {
            from,
            to: line ? line.to : 0,
            severity: "error",
            source: STAGE_WORDS[problem.stage],
            message: problem.message,
          }
        })
      } catch {
        // ⚠️ A failed validation request is not an invalid policy. Reporting one as the other would
        // paint somebody's correct document red the moment the network hiccuped.
        return []
      }
      }),
    [],
  )

  return (
    <div className="min-h-96 overflow-hidden rounded-md border">
      <CodeMirror
        value={source}
        height="60vh"
        readOnly={readOnly}
        editable={!readOnly}
        onChange={onChange}
        // ⚠️ `none`, and it matters: left unset, @uiw/react-codemirror bolts its OWN light theme on
        // and the editor comes up on white paper inside a dark application — with the shared palette
        // painting dark-mode colours onto it, which is unreadable and looks like the palette’s fault.
        theme="none"
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly }}
        extensions={[jmpSyntax(), ...codeThemeExtensions, lintGutter(), policyLinter, EditorView.lineWrapping]}
      />
    </div>
  )
}
