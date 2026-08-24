import { MarkdownRenderer } from "@jmouse/markdown"
import type { PageRenderStyle } from "@/api/blocks"
import { INNOVENTA_READER_PLUGINS } from "./plugins"
import { proseWrapperClass } from "./renderStyles"
import { useMarkdownContext, type MarkdownSurface } from "./surface"

/**
 * The single entry point for rendering a page's markdown.
 *
 * ⚠️ **One component for the editor's preview, the page itself, the public share and the embed.** Two
 * renderers is how a callout comes out one colour while writing and another once published, and nobody
 * can say which is the document. Everything that legitimately differs between those four surfaces is
 * carried by `surface` — which is one argument, and decides one thing.
 *
 * ⚠️ **A thin adapter, and it should stay thin.** The library parses, resolves and dispatches;
 * everything Innoventa-specific arrives through `INNOVENTA_READER_PLUGINS`. What is left here is the two
 * things that genuinely belong to a *page*: its typographic voice, and its surface.
 */
export function PageMarkdown({
  markdown,
  surface,
  renderStyle = "REGULAR",
  dense = false,
  className,
}: {
  markdown: string
  /** Where this is rendered — decides how, and whether, the live `:::` blocks resolve. */
  surface: MarkdownSurface
  renderStyle?: PageRenderStyle
  /** Smaller base type, for a panel rather than a page. Headings scale with it. */
  dense?: boolean
  className?: string
}) {
  const context = useMarkdownContext(surface)

  return (
    <MarkdownRenderer
      markdown={markdown ?? ""}
      plugins={INNOVENTA_READER_PLUGINS}
      context={context}
      className={proseWrapperClass(renderStyle, dense, className)}
    />
  )
}
