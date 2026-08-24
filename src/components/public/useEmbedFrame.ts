import { useEffect, useRef } from "react"

/**
 * What a page rendered inside somebody else's iframe has to do that no other page does.
 *
 * ⚠️ **An iframe has no idea how tall its content is.** The host sized the rectangle before this
 * document existed, so a form taller than the guess is cut off and one shorter leaves a gap. The only
 * way out is for the frame to measure itself and tell the parent — which is what this does, on every
 * resize, and once more after the fonts land because web fonts change the measurement after first paint.
 *
 * ⚠️ **`html, body { height: 100% }` is what makes the measurement wrong.** With it, `scrollHeight` can
 * never exceed the iframe viewport — so the content reports exactly the height it was already given and
 * the frame never grows. Both are reset to `auto` here and restored on unmount.
 *
 * ⚠️ **The theme is NOT set here.** It arrives through `ThemeProvider`'s `initialOverrides`, read off
 * the address in `Application.tsx` — the provider is the only thing allowed to write the root element,
 * so a screen applying a class in its own effect runs first and is overwritten on the next paint.
 */
export function useEmbedFrame() {
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement

    root.style.height = "auto"
    document.body.style.height = "auto"
    document.body.style.overflowY = "hidden"

    function reportHeight() {
      // ⚠️ `getBoundingClientRect` rather than `body.scrollHeight`: the rect includes the wrapper's own
      // padding on every side, and scrollHeight has been seen to miss a flex container's padding-bottom.
      const height = frame.current
        ? Math.ceil(frame.current.getBoundingClientRect().height)
        : document.body.scrollHeight

      window.parent?.postMessage({ type: "innoventa:embed-resize", height }, "*")
    }

    reportHeight()
    document.fonts?.ready.then(reportHeight)

    const observer = new ResizeObserver(reportHeight)
    observer.observe(frame.current ?? document.body)

    return () => {
      observer.disconnect()
      root.style.height = ""
      document.body.style.height = ""
      document.body.style.overflowY = ""
    }
  }, [])

  return frame
}
