import {
  blockPickerPlugin,
  FORMAT_ACTION_IDS,
  imageInsertPlugin,
  linkPlugin,
  rowToggle,
  snippetPickerPlugin,
  tablePlugin,
  TOOLBAR_SPACER,
} from "@jmouse/markdown"
import type { BlockDescriptor, MarkdownPlugin, SnippetTemplate, ToolbarLayout } from "@jmouse/markdown"
import { INNOVENTA_CLIENT_BLOCKS, INNOVENTA_READER_PLUGINS } from "@/components/markdown/plugins"
import { INNOVENTA_MARKDOWN_GRAMMAR } from "@/lib/codemirror"
import type { InnoventaMarkdownContext } from "@/components/markdown/surface"

/**
 * The **writing** half of Innoventa's Markdown stack (INVT-0121).
 *
 * <h2>⚠️ This did not exist, and its absence is why Pages could only be read</h2>
 *
 * `plugins.ts` is the reader's set and was the whole of it: this interface rendered documents and had
 * no way to make one. Everything here is what a writing surface adds on top — the source grammar, the
 * dialogs, the palettes and the toolbar. Nothing below changes what a page may *contain*; that is still
 * decided once, in the reader's list, and a palette entry the renderer does not understand would be a
 * button that produces grey text.
 *
 * <h2>⚠️ The live-data blocks are NOT in the palette, unlike Tessera's</h2>
 *
 * Tessera lists its three because its resolvers are unconditional. Innoventa's are not: which
 * directives a workspace may write depends on which modules it has, and the backend already answers
 * that at `/api/blocks/catalog`. `blockPickerPlugin` takes its entries at **construction** and the
 * plugin list has to be stable across renders, so a fetched palette cannot drive it — which is why the
 * static list here carries only the blocks that need no server at all.
 *
 * <p>⚠️ Offering `:::stock` here regardless would be worse than omitting it: in a workspace without
 * inventory it inserts a directive that renders a refusal, and nobody would connect the two.
 */

/**
 * The blocks the `:::` palette offers.
 *
 * ⚠️ **Client-side only, and taken from the reader's own list** rather than written out again — two
 * copies of this drift, and the one that drifts is always the palette, which then offers a construct
 * the renderer dropped.
 */
export const INNOVENTA_BLOCKS: readonly BlockDescriptor[] = INNOVENTA_CLIENT_BLOCKS.map((block) => ({
  name: block.name,
  label: block.label,
  hint: block.hint,
  example: block.example,
}))

/** Scaffolds for the constructs nobody remembers the syntax of. */
export const INNOVENTA_SNIPPETS: readonly SnippetTemplate[] = [
  {
    key: "mermaid-flow",
    label: "Flowchart",
    hint: "boxes and arrows — rendered in the browser",
    ownLine: true,
    template:
      ";;;mermaid\n" +
      "graph TD\n" +
      "  A[Received] --> B{Passes incoming check?}\n" +
      "  B -->|yes| C[Into stock]\n" +
      "  B -->|no| D[Quarantine]\n" +
      ";;;",
  },
  {
    key: "wavedrom",
    label: "Timing diagram",
    hint: "a waveform, drawn from JSON",
    ownLine: true,
    template:
      ";;;wavedrom\n" +
      '{ "signal": [\n' +
      '  { "name": "clk",  "wave": "p......" },\n' +
      '  { "name": "cs",   "wave": "10....1" },\n' +
      '  { "name": "mosi", "wave": "x.34..x", "data": ["cmd", "addr"] }\n' +
      "] }\n" +
      ";;;",
  },
  {
    key: "math-block",
    label: "Math block",
    hint: "centred display formula (KaTeX)",
    ownLine: true,
    template: "$$\nP = V_{rms} \\times I_{rms} \\times \\cos\\varphi\n$$",
  },
  {
    key: "jme",
    label: "Applet",
    hint: "a live expression, evaluated by this workspace",
    ownLine: true,
    // ⚠️ The one snippet that is genuinely Innoventa's rather than a library construct: the expression
    // is evaluated against THIS workspace, which is what makes a page beside an inventory worth having.
    template: ";;;jme\n{ \"expression\": \"1 + 1\" }\n;;;",
  },
]

/**
 * Everything a reader gets, plus the dialogs and palettes for writing it.
 *
 * <p>⚠️ **Not the whole editor list.** The fast-preview dialog cannot be assembled here because it
 * needs the renderer to preview *with*; it is added beside the component that renders — see
 * `InnoventaMarkdown.tsx`.
 */
/**
 * Markdown highlighting for the source editor.
 *
 * ⚠️ A plugin with no renderer and no toolbar action — the library takes CodeMirror extensions from
 * plugins exactly as it takes constructs from them, so the grammar arrives the same way everything
 * else does rather than through a prop on the editor.
 */
function markdownGrammarPlugin(): MarkdownPlugin<InnoventaMarkdownContext> {
  return { name: "markdown-grammar", editorExtensions: INNOVENTA_MARKDOWN_GRAMMAR }
}

export const INNOVENTA_WRITING_PLUGINS: readonly MarkdownPlugin<InnoventaMarkdownContext>[] = [
  ...INNOVENTA_READER_PLUGINS,
  markdownGrammarPlugin(),
  linkPlugin(),
  imageInsertPlugin(),
  tablePlugin(),
  blockPickerPlugin({ blocks: INNOVENTA_BLOCKS, trigger: /^:::$/ }),
  snippetPickerPlugin({
    id: "diagram",
    label: "📈 Diagram / math",
    title: "Insert a diagram or formula",
    templates: INNOVENTA_SNIPPETS,
  }),
] as readonly MarkdownPlugin<InnoventaMarkdownContext>[]

/** The id the fast-preview plugin registers under, named here and defined next to the renderer. */
export const FAST_PREVIEW_ACTION = "preview.modal"

/**
 * Where each button sits: the constructs on one row, the formatting shortcuts behind a toggle on a
 * second.
 *
 * <p>Twelve format buttons open by default would be a wall of glyphs above a field somebody wanted to
 * type one sentence into — and anybody reaching for `**bold**` already knows how to type it. The row is
 * there for the person who does not.
 *
 * <p>⚠️ **Preview is a modal, not the library's side-by-side split.** A page sits beside its section
 * tree here, and halving that column leaves neither half worth reading.
 */
export const INNOVENTA_TOOLBAR: ToolbarLayout = [
  [
    "link",
    "image",
    "block-picker",
    "diagram",
    rowToggle("format", "✎ Format", "Markdown formatting shortcuts"),
    TOOLBAR_SPACER,
    FAST_PREVIEW_ACTION,
  ],
  { id: "format", hidden: true, actions: [...FORMAT_ACTION_IDS, "table"] },
]
