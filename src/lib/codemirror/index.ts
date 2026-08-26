import { languages } from "@codemirror/language-data"
import { editorChrome } from "@jmouse/codemirror/editor"
import { markdownGrammar } from "@jmouse/codemirror/markdown"
import {
  createStaticHighlighter,
  EXPRESSION_LANGUAGE,
  MAPPING_LANGUAGE,
  POLICY_LANGUAGE,
  QUERY_LANGUAGE,
  SYNTAX_HIGHLIGHT_STYLE,
} from "@jmouse/codemirror/highlight"

export { jmpSyntax, jmeSyntax } from "@jmouse/codemirror"

/**
 * Innoventa's CodeMirror configuration — which grammars it answers for, and nothing else.
 *
 * <p>⚠️ **There is deliberately nothing else here.** The grammars, the tags, the palette, the editor
 * frame, the picker and the store are all `@jmouse/codemirror`'s. Every line this file used to carry
 * about how an editor should *look* was a copy of a decision made once, and each one was a way for
 * this interface to drift away from the other four — which it did, twice, and both times somebody had
 * to notice it on a screen rather than in a build.
 *
 * <p>The only product decision left is the list below: **all four** jMouse dialects, because this is
 * where all four are written — a policy file on the access screen, an expression in a validation rule
 * and in a ` ```jme ` fence in the manual, a saved view behind a listing, and a mapping file behind an
 * import.
 *
 * <p>⚠️ **This colours; it does not decide.** Whether a policy or an expression is valid is answered by
 * the real parser over HTTP, never here.
 *
 * <p>⚠️ **A dialect missing from this list does not fail — it renders as plain text.** The catalogue is
 * asked next, it has never heard of any of them, and the fence comes out grey, which on screen is
 * indistinguishable from a fence somebody mislabelled.
 */
export const { highlightToHtml, resolveParser, highlightFencedCode } = createStaticHighlighter({
  highlightStyle: SYNTAX_HIGHLIGHT_STYLE,
  grammars: [POLICY_LANGUAGE, EXPRESSION_LANGUAGE, QUERY_LANGUAGE, MAPPING_LANGUAGE],
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
