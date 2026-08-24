import { useEffect, useRef } from "react"

export interface KeyboardShortcut {
  /** The key itself, compared case-insensitively — `"e"`, `"s"`, `"Escape"`. */
  key: string
  /** Whether Ctrl — Cmd on a Mac — has to be held. */
  withControl?: boolean
  /** A shortcut that is off is not listening at all, rather than listening and declining. */
  enabled?: boolean
  onTrigger: (event: KeyboardEvent) => void
}

/**
 * A screen-wide keyboard shortcut, the way a tracker has them: `E` to edit, `Ctrl+S` to save.
 *
 * <h2>⚠️ A bare letter belongs to whoever is typing</h2>
 *
 * <p>`E` opening the editor is a nicety; `E` opening the editor while somebody is writing the *title*
 * swallows a letter out of their sentence, and they never find out why. So a shortcut with no modifier
 * refuses to fire while the focus is in a field — an input, a textarea, a `contenteditable`, or the
 * CodeMirror surface the Markdown editor is made of. A `Ctrl` shortcut does the opposite and fires
 * precisely *because* somebody is typing: that is what saving is.
 *
 * <h2>⚠️ And no shortcut reaches past an open dialog</h2>
 *
 * <p>The Markdown toolbar's dialogs are portalled to `document.body`, so their keystrokes arrive at
 * `window` like everybody else's. A dialog is a conversation the screen behind it has no business
 * answering.
 */
export function useKeyboardShortcut({
  key,
  withControl = false,
  enabled = true,
  onTrigger,
}: KeyboardShortcut) {
  // Through a reference, so the listener is bound once per shortcut rather than re-bound on every
  // keystroke a handler happens to close over — a draft, in the only case that matters.
  const handler = useRef(onTrigger)

  useEffect(() => {
    handler.current = onTrigger
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key.toLowerCase() || event.altKey) {
        return
      }

      if (withControl !== (event.ctrlKey || event.metaKey)) {
        return
      }

      if (!withControl && (event.shiftKey || isWritingSomewhere(event.target))) {
        return
      }

      if (document.querySelector("[role='dialog']")) {
        return
      }

      // Before the handler rather than inside it: `Ctrl+S` has to lose its browser meaning even in the
      // cases where this particular listener decides the save is not its own.
      event.preventDefault()
      handler.current(event)
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [key, withControl, enabled])
}

/** Whether the keystroke landed somewhere a letter is text rather than a command. */
function isWritingSomewhere(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable || target.closest(".cm-editor")) {
    return true
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}
