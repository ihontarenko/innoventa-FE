import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@jmouse/ui"
import {
  clamp,
  cropWindowFor,
  loadImage,
  panLimits,
  squareToPng,
  type LoadedImage,
} from "@/lib/squareImage"

export interface CropperHandle {
  /** The chosen square, encoded as a 256x256 PNG. */
  toSquarePng: () => Promise<Blob>
}

/** Side of the preview, in CSS pixels. The crop is computed in source pixels, so this is only layout. */
const VIEWPORT = 224

const ZOOM_LOWEST = 1
const ZOOM_HIGHEST = 4
const ZOOM_STEP = 0.01

/**
 * Drag to move, slide to zoom, and what you see is what is stored.
 *
 * ⚠️ **A real cropper rather than an automatic centre crop**, which is the cheap version and is wrong
 * often enough to matter: people are rarely centred in their own photographs, and a face sliced down
 * the middle is worse than no picture. This is roughly a hundred lines to never do that.
 *
 * The image is rendered as a plain transformed `<img>` and only redrawn to a canvas on save — panning a
 * canvas every pointer move would mean re-decoding a multi-megapixel image at sixty frames a second for
 * a preview the compositor can do for free.
 */
export const ImageSquareCropper = forwardRef<CropperHandle, { file: File; onDiscard: () => void }>(
  function ImageSquareCropper({ file, onDiscard }, reference) {
    const [image, setImage] = useState<LoadedImage | null>(null)
    const [failure, setFailure] = useState<string | null>(null)
    const [zoom, setZoom] = useState(ZOOM_LOWEST)
    const [offset, setOffset] = useState({ x: 0, y: 0 })

    const drag = useRef<{ pointerId: number; fromX: number; fromY: number } | null>(null)

    useEffect(() => {
      let abandoned = false
      let loaded: LoadedImage | null = null

      setImage(null)
      setFailure(null)
      setZoom(ZOOM_LOWEST)
      setOffset({ x: 0, y: 0 })

      loadImage(file)
        .then((result) => {
          loaded = result

          // The effect may have been superseded while the image decoded; releasing here rather than
          // storing it is what stops the object URL leaking.
          if (abandoned) {
            result.release()
            return
          }

          setImage(result)
        })
        .catch((error: Error) => {
          if (!abandoned) {
            setFailure(error.message)
          }
        })

      return () => {
        abandoned = true
        loaded?.release()
      }
    }, [file])

    // Zooming out can leave the image no longer covering the viewport, so the pan has to be pulled back
    // inside the new limits rather than left where the drag put it.
    useEffect(() => {
      if (!image) {
        return
      }

      const limits = panLimits(image, VIEWPORT, zoom)

      setOffset((current) => ({
        x: clamp(current.x, -limits.x, limits.x),
        y: clamp(current.y, -limits.y, limits.y),
      }))
    }, [image, zoom])

    useImperativeHandle(
      reference,
      () => ({
        toSquarePng: () => {
          if (!image) {
            return Promise.reject(new Error("The picture has not finished loading."))
          }

          return squareToPng(image.element, cropWindowFor(image, VIEWPORT, zoom, offset.x, offset.y))
        },
      }),
      [image, zoom, offset]
    )

    if (failure) {
      return (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-destructive-ink">
          {failure}
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            Choose another
          </Button>
        </div>
      )
    }

    if (!image) {
      return <div className="h-56 animate-pulse rounded-lg bg-muted" />
    }

    const scale = (VIEWPORT / Math.min(image.width, image.height)) * zoom

    const move = (event: React.PointerEvent) => {
      if (drag.current?.pointerId !== event.pointerId) {
        return
      }

      const limits = panLimits(image, VIEWPORT, zoom)

      setOffset({
        x: clamp(event.clientX - drag.current.fromX, -limits.x, limits.x),
        y: clamp(event.clientY - drag.current.fromY, -limits.y, limits.y),
      })
    }

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div
            className="overflow-hidden rounded-full border bg-muted touch-none select-none"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            onPointerDown={(event) => {
              drag.current = {
                pointerId: event.pointerId,
                fromX: event.clientX - offset.x,
                fromY: event.clientY - offset.y,
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null
            }}
            onPointerCancel={() => {
              drag.current = null
            }}
          >
            <img
              src={image.element.src}
              alt=""
              draggable={false}
              className="max-w-none cursor-grab active:cursor-grabbing"
              style={{
                width: image.width * scale,
                height: image.height * scale,
                transform: `translate(${offset.x + (VIEWPORT - image.width * scale) / 2}px, ${
                  offset.y + (VIEWPORT - image.height * scale) / 2
                }px)`,
              }}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -top-2 -right-2 size-7 rounded-full"
            onClick={onDiscard}
            aria-label="Choose a different picture"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <input
          type="range"
          min={ZOOM_LOWEST}
          max={ZOOM_HIGHEST}
          step={ZOOM_STEP}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          aria-label="Zoom"
          className="w-56 accent-primary"
        />

        <p className="text-xs text-muted-foreground">Drag to move, slide to zoom.</p>
      </div>
    )
  }
)
