import type { MarkdownPlugin } from "@jmouse/markdown"
import {
  calloutPlugin,
  codeHighlightPlugin,
  dataBlockPlugin,
  externalLinkPlugin,
  frontmatterPlugin,
  gfmPlugin,
  imagePlugin,
  mathPlugin,
  mermaidPlugin,
  youtubePlugin,
} from "@jmouse/markdown/plugins"
// ⚠️ Two constructs live behind their own specifiers because each costs a dependency: the applet needs
// an evaluator endpoint, and the timing diagrams pull `wavedrom` and `json5`. Innoventa is the only
// product here that writes either.
import { jmePlugin } from "@jmouse/markdown/jme"
import { wavedromPlugin } from "@jmouse/markdown/wavedrom"
import type { PageBlockResponse } from "@/api/blocks"
import { highlightFencedCode } from "@/lib/codemirror"
import { fileViewerHref, innoventaEvaluator } from "./evaluator"
import { INNOVENTA_DATA_DIRECTIVES, InnoventaDataBlock, useInnoventaBlocks } from "./liveBlocks"
import type { InnoventaMarkdownContext } from "./surface"

/**
 * Innoventa's markdown stack, assembled from the library.
 *
 * ⚠️ **This file is the whole of what the product configures.** Everything below it is a general-purpose
 * engine that knows CommonMark and two block shapes; everything a page can actually *contain* — a part
 * card, a waveform, an applet pointed at Innoventa's evaluator — is named here and nowhere else. Adding
 * a construct is a line in this list; a product with different constructs writes a different list and
 * shares every line of the engine.
 *
 * ⚠️ **This is the *reader's* set.** A writing surface adds the toolbar, the block palette and the source
 * grammar on top of it — everything below is what somebody merely reading a page needs, and a reader
 * needs nothing about writing one.
 */
export const INNOVENTA_READER_PLUGINS: readonly MarkdownPlugin<InnoventaMarkdownContext>[] = [
  gfmPlugin(),
  // ⚠️ The document's own `---` metadata block, and the only entry here that fixes something rather
  // than adding something. Nothing Innoventa writes opens with one, but a document pasted from a skill
  // file, an agent's notes or a Kiwi page does — and read as prose CommonMark makes the closing `---` a
  // setext underline, so the metadata becomes the largest heading on the screen. Installed so that one
  // document says the same thing in every interface that shares this library.
  frontmatterPlugin(),
  mathPlugin(),
  externalLinkPlugin(),
  imagePlugin({ linkify: fileViewerHref }),
  // ⚠️ The editor's own grammars and the editor's own palette, so a snippet reads identically
  // written and published — see `lib/codemirror`.
  codeHighlightPlugin({ highlight: highlightFencedCode }),
  calloutPlugin(),
  youtubePlugin(),
  mermaidPlugin(),
  wavedromPlugin(),
  // ⚠️ One endpoint is the whole configuration: a binding declares its own input *type*, so the library
  // draws the control and the document says what it is.
  jmePlugin<InnoventaMarkdownContext>({ evaluator: innoventaEvaluator }),
  dataBlockPlugin<InnoventaMarkdownContext, PageBlockResponse>({
    name: "live-data",
    directives: INNOVENTA_DATA_DIRECTIVES,
    load: useInnoventaBlocks,
    render: InnoventaDataBlock,
  }),
] as readonly MarkdownPlugin<InnoventaMarkdownContext>[]

/**
 * The blocks that need no server, and are therefore offered everywhere.
 *
 * ⚠️ **Listed here rather than served, because there is nothing for a workspace to *have*.** A callout is
 * four lines of CSS; asking the backend whether this workspace may draw a coloured box would be a round
 * trip to be told yes.
 */
export const INNOVENTA_CLIENT_BLOCKS = [
  { name: "youtube", label: "YouTube video", hint: "link, optional WxH or %", example: "https://youtu.be/dQw4w9WgXcQ 560x315" },
  { name: "note", label: "Note callout", hint: "message text", example: "Double-check the footprint." },
  { name: "tip", label: "Tip callout", hint: "message text", example: "Prefer the E24 grid." },
  { name: "warning", label: "Warning callout", hint: "message text", example: "ESD-sensitive — ground yourself." },
  { name: "info", label: "Info callout", hint: "message text", example: "Datasheet rev C." },
] as const
