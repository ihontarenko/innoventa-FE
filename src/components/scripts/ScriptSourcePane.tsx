import { useMemo, useRef } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint"
import { EditorView } from "@codemirror/view"
import { jmsSyntax } from "@jmouse/codemirror"
import { catalogueCompletion, JMS_COMPLETION_RULES, type CompletionCatalogue } from "@jmouse/codemirror/completion"
import { useCodeThemeExtensions } from "@jmouse/codemirror/react"
import { scriptsApi, type ScriptProblemStage } from "@/api/scripts"

/**
 * A `.jms` document as text — coloured here, judged on the server, completed from the host's catalogue.
 *
 * ## ⚠️ Three jobs, and only one of them is the browser's
 *
 * | Job | Who | Why |
 * |---|---|---|
 * | colour | `jmsSyntax` in `@jmouse/codemirror` | a language's keywords are the language's |
 * | offer  | `catalogueCompletion`, fed over HTTP | what a script may *name* is the host's data |
 * | decide | `POST /scripts/rehearse` | the real parser and the real binder, and nothing else |
 *
 * A TypeScript re-implementation of the third would be a second grammar. It agrees with the first for
 * about a month — after which the editor calls a document good and the boot refuses it, or, far worse,
 * the other way round and somebody's rule silently stops firing.
 *
 * ## ⚠️ The catalogue is read through a ref, not closed over
 *
 * `catalogueCompletion` takes a *getter* so completion starts working the moment the fetch lands
 * without the editor being rebuilt — and so that "still in flight" is an ordinary answer rather than a
 * special case. Closing over the value instead would freeze whatever was there when the editor mounted,
 * which on a first paint is nothing at all.
 */

/** Two stages, two different next moves — so the gutter says which one refused. */
const STAGE_WORDS: Record<ScriptProblemStage, string> = {
  PARSE: "syntax",
  BIND: "binding",
}

export function ScriptSourcePane({
  name,
  source,
  catalogue,
  onChange,
  readOnly = false,
}: {
  name: string
  source: string
  catalogue: CompletionCatalogue | null
  onChange?: (next: string) => void
  readOnly?: boolean
}) {
  const codeThemeExtensions = useCodeThemeExtensions()

  // ⚠️ The name travels the same way the catalogue does. It is part of what a refusal says — the host
  // quotes it back — and it changes while somebody renames a document with the editor open.
  const latest = useRef({ name, catalogue })

  latest.current = { name, catalogue }

  // ⚠️ Built once. A linter recreated on every render restarts CodeMirror's own debounce, so a document
  // being typed into is rehearsed on the first keystroke and then never again until typing stops.
  const scriptLinter = useMemo(
    () =>
      linter(async (view): Promise<Diagnostic[]> => {
        const text = view.state.doc.toString()

        if (!text.trim()) {
          return []
        }

        try {
          const { data } = await scriptsApi.rehearse(latest.current.name || "untitled", text)

          if (data.valid || !data.problem) {
            return []
          }

          const problem = data.problem
          // ⚠️ `line` is 0 where the refusal has no position — anchored at the very start rather than
          // dropped, because a problem with nowhere to point is still a problem.
          const line =
            problem.line > 0 ? view.state.doc.line(Math.min(problem.line, view.state.doc.lines)) : null
          const from = line ? line.from + Math.max(0, problem.column - 1) : 0

          return [
            {
              from,
              to: line ? line.to : 0,
              severity: "error",
              source: STAGE_WORDS[problem.stage],
              message: problem.message,
            },
          ]
        } catch {
          // ⚠️ A failed rehearsal request is not an invalid script. Reporting one as the other paints
          // somebody's correct document red the moment the network hiccups.
          return []
        }
      }),
    [],
  )

  const completion = useMemo(
    () => catalogueCompletion({ catalogue: () => latest.current.catalogue, rules: JMS_COMPLETION_RULES }),
    [],
  )

  return (
    <div className="min-h-0 flex-1 overflow-hidden border-t">
      <CodeMirror
        value={source}
        height="100%"
        className="h-full"
        readOnly={readOnly}
        editable={!readOnly}
        onChange={onChange}
        // ⚠️ `none`, and it matters: left unset, @uiw/react-codemirror bolts its own light theme on and
        // the editor comes up on white paper inside a dark application.
        theme="none"
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly }}
        extensions={[
          jmsSyntax(),
          ...codeThemeExtensions,
          lintGutter(),
          scriptLinter,
          completion,
          EditorView.lineWrapping,
        ]}
      />
    </div>
  )
}
