import { useEffect, useRef, useState } from "react"

/**
 * The **host** half of the embed protocol — the side that owns the iframe.
 *
 * ⚠️ **It lives in the same directory as `useEmbedFrame`, which is the other half, on purpose.** One
 * message name (`innoventa:embed-resize`) and one payload shape are the whole contract between a page in
 * this product and a page inside it; splitting them across the tree is how one side starts sending
 * `{ height }` while the other reads `{ contentHeight }` and nobody notices until an embed is the wrong
 * size on somebody else's site.
 *
 * ⚠️ **The sender is checked by `contentWindow`, never by origin string or by trusting the message.**
 * Any page on the internet can post `innoventa:embed-resize` to this window; identifying the frame by
 * object identity is what stops a hostile page resizing an iframe it does not own. It also lets several
 * embeds share one listener without their heights crossing.
 */
export function useEmbedHeight() {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(600)

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.data?.type !== "innoventa:embed-resize") {
        return
      }

      if (frame.current?.contentWindow === event.source) {
        setHeight(event.data.height)
      }
    }

    window.addEventListener("message", receive)

    return () => window.removeEventListener("message", receive)
  }, [])

  return { frame, height }
}

/**
 * One embedded Innoventa surface, sized by what it reports.
 *
 * ⚠️ **`scrolling="no"` and no border.** The frame is exactly as tall as its content, so a scrollbar
 * would be a scrollbar on a thing that cannot scroll — and a border would draw a box around something
 * meant to read as part of the page it is in.
 */
export function EmbedHost({ src, title, className }: { src: string; title: string; className?: string }) {
  const { frame, height } = useEmbedHeight()

  return (
    <iframe
      ref={frame}
      src={src}
      title={title}
      scrolling="no"
      style={{ height }}
      className={`w-full border-0 ${className ?? ""}`}
    />
  )
}
