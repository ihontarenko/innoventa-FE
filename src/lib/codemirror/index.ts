import { languages } from "@codemirror/language-data"
import { editorChrome } from "@jmouse/codemirror/editor"
import { markdownGrammar } from "@jmouse/codemirror/markdown"
import {
  createStaticHighlighter,
  EXPRESSION_LANGUAGE,
  POLICY_LANGUAGE,
  SYNTAX_HIGHLIGHT_STYLE,
} from "@jmouse/codemirror/highlight"

export { jmpSyntax, jMouseEL } from "@jmouse/codemirror"

/**
 * Innoventa's CodeMirror configuration — which grammars it answers for, and nothing else.
 *
 * <p>⚠️ **There is deliberately nothing else here.** The grammars, the tags, the palette, the editor
 * frame, the picker and the store are all `@jmouse/codemirror`'s. Every line this file used to carry
 * about how an editor should *look* was a copy of a decision made once, and each one was a way for
 * this interface to drift away from the other four — which it did, twice, and both times somebody had
 * to notice it on a screen rather than in a build.
 *
 * <p>The only product decision left is the list below: **both** jMouse languages, because this is where
 * both are written — a policy file on the access screen, an expression in a validation rule and in a
 * ` ```jme ` fence in the manual.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a policy or an expression is valid is answered by
 * the real parser over HTTP, never here.
 */
export const { highlightToHtml, resolveParser, highlightFencedCode } = createStaticHighlighter({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  grammars: [POLICY_LANGUAGE, EXPRESSION_LANGUAGE],
  catalogue: languages,
})

/**
 * The page editor's stack: the Markdown grammar, the shared palette, and the chrome (INVT-0121).
 *
 * <p>⚠️ **The same palette the reader sees.** A fenced block coloured one way while writing and another
 * once saved is how somebody stops trusting the preview — which is the only thing the preview is for.
 * Both sides read `SYNTAX_HIGHLIGHT_STYLE`, so they cannot come apart.
 */
export const INNOVENTA_MARKDOWN_GRAMMAR = markdownGrammar({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  chrome: editorChrome(),
  codeLanguages: languages,
})
