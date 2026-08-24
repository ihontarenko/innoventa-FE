import type { CSSProperties } from "react"
import { Dialog, dialogActionPlugin, MarkdownEditor, MarkdownUiProvider } from "@jmouse/markdown"
import type { MarkdownPlugin } from "@jmouse/markdown"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { INNOVENTA_MARKDOWN_UI } from "@/components/markdown/innoventaUiKit"
import { APP_SURFACE, useMarkdownContext, type InnoventaMarkdownContext } from "@/components/markdown/surface"
import { FAST_PREVIEW_ACTION, INNOVENTA_TOOLBAR, INNOVENTA_WRITING_PLUGINS } from "@/components/markdown/writing"

/**
 * A document, **written** (INVT-0121).
 *
 * <h2>⚠️ Reading already had a home; writing did not</h2>
 *
 * `PageMarkdown` has drawn documents here since the interface was ported. Nothing could produce one:
 * the Pages screen offered a link to Kiwi's own editor instead, on the reasoning that writing and
 * access are Kiwi's. Access is. **Writing is not** — Kiwi refuses a write it does not allow, and the
 * honest interface offers the control and repeats the refusal. Hiding it on a local guess reproduces
 * Kiwi's rules here, badly, and the first time the two disagree the wrong one is the invisible one.
 *
 * <h2>⚠️ One renderer for the source's preview and for the page</h2>
 *
 * The preview goes through {@link PageMarkdown}, the same component the saved page uses. Two renderers
 * is how a callout comes out one colour while writing and another once published, with nobody able to
 * say which one is the document.
 *
 * <h2>⚠️ The editor asks the host for its widgets</h2>
 *
 * It ships no buttons, inputs or modals of its own, so every dialog it opens is built out of
 * Innoventa's — see {@link INNOVENTA_MARKDOWN_UI}. That binding is the whole cost of adopting it, and
 * it is why there is no second design system here to drift from the first.
 */

/**
 * ⚠️ **Defined here rather than in `writing.ts`, and it has to be**: a preview plugin needs the
 * renderer to preview *with*, and that is the component in this file.
 */
const fastPreviewPlugin = dialogActionPlugin({
  id: FAST_PREVIEW_ACTION,
  label: "⚡ Preview",
  title: "Preview the whole document",
  dialog: ({ editor, close }) => (
    <Dialog title="Preview" width={880} onClose={close}>
      <div className="max-h-[70vh] overflow-y-auto">
        {/* ⚠️ `APP_SURFACE`, so the live blocks resolve exactly as they will once saved — a preview
            that showed a notice where the page will show a number is not a preview. */}
        <PageMarkdown markdown={editor.getValue()} surface={APP_SURFACE} />
      </div>
    </Dialog>
  ),
})

/**
 * ⚠️ Built once, at module scope. The library mounts one provider per data-bearing plugin, so a list
 * rebuilt between renders changes hook order — which fails loudly, but only on the render after the
 * one that introduced it.
 */
const INNOVENTA_EDITOR_PLUGINS = [
  ...INNOVENTA_WRITING_PLUGINS,
  fastPreviewPlugin,
] as readonly MarkdownPlugin<InnoventaMarkdownContext>[]

export function InnoventaMarkdown({ markdown }: { markdown: string | null | undefined }) {
  return <PageMarkdown markdown={markdown ?? ""} surface={APP_SURFACE} />
}

/**
 * The source, and a toolbar over it.
 *
 * ⚠️ **The context is the surface**, the same one the reader gets. A `:::stock` typed a moment ago
 * resolves against this workspace while it is being written, which is the entire reason a page next to
 * an inventory is worth having.
 */
export function InnoventaMarkdownEditor({
  value,
  onChange,
  placeholder,
  /** How tall the source surface stands. A note wants less room than a page. */
  height = "22rem",
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  height?: string
}) {
  const context = useMarkdownContext(APP_SURFACE)

  return (
    <MarkdownUiProvider kit={INNOVENTA_MARKDOWN_UI}>
      <div className="innoventa-markdown" style={{ "--markdown-editor-height": height } as CSSProperties}>
        <MarkdownEditor
          value={value}
          onChange={onChange}
          plugins={INNOVENTA_EDITOR_PLUGINS}
          context={context}
          toolbar={INNOVENTA_TOOLBAR}
          placeholder={placeholder}
        />
      </div>
    </MarkdownUiProvider>
  )
}
