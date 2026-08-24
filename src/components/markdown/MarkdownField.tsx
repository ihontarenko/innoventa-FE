import { useEffect, useRef, useState } from "react"
import { Button, cn } from "@jmouse/ui"
import { InnoventaMarkdown, InnoventaMarkdownEditor } from "@/components/markdown/InnoventaMarkdown"
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut"

/**
 * A Markdown field that is read in place and written in place — but not, unlike
 * {@link ../inline/InlineTextField}, by being an input the whole time.
 *
 * <h2>⚠️ Why this one has an edit mode when nothing else in Innoventa does</h2>
 *
 * <p>The inline pattern works because a summary looks the same typed as it does read. A description
 * does not: a table, a `;;;mermaid` diagram and a `TES-42` reference are the *rendered* thing, and a
 * field that were permanently a textarea would mean nobody ever sees them. So this shows the document
 * and swaps to the editor on request.
 *
 * <p>⚠️ **And it commits on a button rather than on blur**, which is the other break from the inline
 * pattern and the reason it cannot simply reuse it. The editor's toolbar opens dialogs; a dialog takes
 * focus; commit-on-blur would save a half-finished document every time somebody reached for the link
 * button. Escape still abandons, because that is the one habit worth keeping.
 *
 * <h2>⚠️ Who opens the editor is the caller's decision, not this component's</h2>
 *
 * <p>A comment is prose and a click into it means "let me fix that word". **A description is not**: it renders
 * live blocks — checkboxes, diagrams, applets — that somebody is meant to *use*, and a click that
 * replaces the thing under the cursor with its own source is the field eating the interaction. So a
 * surface carrying live blocks passes `openOnClick={false}` and drives {@link editing} from a button
 * and a shortcut of its own; a surface of plain remarks keeps the click.
 */
export function MarkdownField({
  value,
  onCommit,
  canEdit,
  placeholder,
  emptyText,
  className,
  editing: editingFromCaller,
  onEditingChange,
  openOnClick = true,
}: {
  value: string
  onCommit: (next: string) => void
  canEdit: boolean
  placeholder?: string
  /** What an empty field says to somebody who cannot edit it — an invitation would be a lie. */
  emptyText?: string
  className?: string
  /** Drive the mode from outside — a toolbar button, a keyboard shortcut. Omit to let it own itself. */
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
  /** Whether clicking the rendered document opens the editor. See the note on live blocks above. */
  openOnClick?: boolean
}) {
  const [editingItself, setEditingItself] = useState(false)
  const [draft, setDraft] = useState(value)
  const container = useRef<HTMLDivElement>(null)

  const editing = editingFromCaller ?? editingItself

  function changeEditing(next: boolean) {
    setEditingItself(next)
    onEditingChange?.(next)
  }

  // A commit elsewhere — the modal, another tab, a tool call — has to win over a draft nobody is
  // typing into. Re-syncing while not editing is what keeps two surfaces one issue rather than two
  // copies; doing it *while* editing would throw away what somebody is writing.
  useEffect(() => {
    if (!editing) {
      setDraft(value)
    }
  }, [value, editing])

  // Opening the editor and then having to click into it is a step nobody wants, and it is the whole
  // difference between a shortcut that saves a keystroke and one that costs a click.
  useEffect(() => {
    if (editing) {
      container.current?.querySelector<HTMLElement>(".cm-content")?.focus()
    }
  }, [editing])

  function commit() {
    onCommit(draft)
    changeEditing(false)
  }

  function abandon() {
    setDraft(value)
    changeEditing(false)
  }

  // ⚠️ At the window rather than on the editor, because the point of Ctrl+S is that it works wherever
  // the hands happen to be — and because the browser's own Save dialog has to lose that combination
  // for as long as a document is open for writing. With two fields open at once (a page and a comment
  // under it) the keystroke goes to the one being typed into, and to this one only when nobody is.
  useKeyboardShortcut({
    key: "s",
    withControl: true,
    enabled: editing,
    onTrigger: (event) => {
      const fieldTypedInto = (event.target as HTMLElement | null)?.closest?.("[data-markdown-field]")

      if (!fieldTypedInto || fieldTypedInto === container.current) {
        commit()
      }
    },
  })

  if (editing) {
    return (
      <div
        ref={container}
        data-markdown-field
        className="space-y-2"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            abandon()
            return
          }
          // The other half of "commits on a button": a document long enough to need a toolbar is long
          // enough that reaching for the mouse to save it is a nuisance. Escape abandons, this commits,
          // and neither is reachable by accident the way commit-on-blur was.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            commit()
          }
        }}
      >
        <InnoventaMarkdownEditor value={draft} onChange={setDraft} placeholder={placeholder} />
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={commit}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={abandon}>
            Cancel
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Markdown · <kbd className="font-mono">⌘S</kbd> or <kbd className="font-mono">⌘↵</kbd> to
            save · <kbd className="font-mono">Esc</kbd> to discard
          </span>
        </div>
      </div>
    )
  }

  // ⚠️ The empty state keeps its click whatever `openOnClick` says: there is no rendered document to
  // interact with, and a blank field with no way in is a page nobody can start writing.
  if (!value.trim()) {
    return canEdit ? (
      <button
        type="button"
        className={cn("w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent", className)}
        onClick={() => changeEditing(true)}
      >
        {placeholder ?? "Add a description…"}
      </button>
    ) : (
      <p className={cn("px-2 py-1.5 text-sm text-muted-foreground", className)}>
        {emptyText ?? "Nothing written."}
      </p>
    )
  }

  const clickOpensTheEditor = canEdit && openOnClick

  return (
    <div
      className={cn("rounded-md px-2 py-1.5", clickOpensTheEditor && "cursor-text hover:bg-accent/40", className)}
      // ⚠️ A click that landed on a link inside the document must follow the link rather than open the
      // editor. Reading a reference is what the references are for, and having to dodge the edit mode
      // to do it would make them worse than plain text.
      onClick={(event) => {
        if (clickOpensTheEditor && !(event.target as HTMLElement).closest("a, button")) {
          changeEditing(true)
        }
      }}
    >
      <InnoventaMarkdown markdown={value} />
    </div>
  )
}
