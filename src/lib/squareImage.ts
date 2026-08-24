/**
 * Turning whatever somebody picked off their disk into an avatar.
 *
 * ⚠️ **The cropping happens here, in the browser, and that is a deliberate division of labour.** A
 * phone photograph is several megabytes of a scene, and what the server needs is a square of a face
 * measured in kilobytes. Doing it before the upload means the backend never carries an imaging
 * dependency, never spends CPU on a resize, and can keep a size ceiling low enough to be meaningful —
 * and it means the person sees the crop they are going to get rather than discovering it afterwards.
 */

/** What every avatar is stored at. Twice the largest place one is rendered, for high-density screens. */
export const AVATAR_PIXELS = 256

/** An image loaded off disk, with the dimensions the cropper needs to lay it out. */
export interface LoadedImage {
  element: HTMLImageElement
  width: number
  height: number
  /** Revokes the object URL backing `element`. Must be called once the image is no longer displayed. */
  release: () => void
}

/**
 * Decodes a file into an image.
 *
 * An object URL rather than a data URL: a data URL base64-encodes the whole file into a string, which
 * for an eight-megabyte photograph is eleven megabytes of JavaScript string built before anything is
 * drawn. The cost of the object URL is having to revoke it, which `release` is for.
 */
export function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file)
    const element = new Image()

    element.onload = () => {
      resolve({
        element,
        width: element.naturalWidth,
        height: element.naturalHeight,
        release: () => URL.revokeObjectURL(source),
      })
    }

    element.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error("That file could not be read as an image."))
    }

    element.src = source
  })
}

/** Where in the source image the square sits, in source pixels. */
export interface CropWindow {
  x: number
  y: number
  /** Side length of the square, in source pixels. */
  side: number
}

/**
 * The square that fills the viewport, given how far the image has been panned and zoomed.
 *
 * `zoom` is 1 when the image is scaled so its shorter side exactly fills the square, which is the
 * furthest out it may go — beyond that the square would include area the image does not cover. `offset`
 * is in viewport pixels, which is what a drag produces, so the conversion back to source pixels happens
 * here and not in the component.
 *
 * ⚠️ **The offset is measured from the centred image, not from its corner**, which is why the half-side
 * term is here. Reading the offset on its own looks right and is silently wrong: an untouched picture
 * has an offset of zero, so every crop nobody dragged came out of the top-left corner of the source —
 * for a photograph on a white background, a white square. It must stay in step with the `translate`
 * that lays the preview out in `ImageSquareCropper`; the two describe the same rectangle.
 */
export function cropWindowFor(
  image: { width: number; height: number },
  viewport: number,
  zoom: number,
  offsetX: number,
  offsetY: number
): CropWindow {
  const cover = viewport / Math.min(image.width, image.height)
  const scale = cover * zoom

  const side = viewport / scale

  return {
    x: clamp((image.width - side) / 2 - offsetX / scale, 0, image.width - side),
    y: clamp((image.height - side) / 2 - offsetY / scale, 0, image.height - side),
    side,
  }
}

/** How far the image may be panned in each direction before it stops covering the viewport. */
export function panLimits(
  image: { width: number; height: number },
  viewport: number,
  zoom: number
): { x: number; y: number } {
  const scale = (viewport / Math.min(image.width, image.height)) * zoom

  return {
    x: Math.max(0, (image.width * scale - viewport) / 2),
    y: Math.max(0, (image.height * scale - viewport) / 2),
  }
}

export function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest)
}

/**
 * Renders the chosen square as a PNG of exactly {@link AVATAR_PIXELS} on a side.
 *
 * PNG rather than WebP or JPEG: an avatar is small enough that the compression difference is noise, and
 * PNG is the one raster format every browser both writes and reads without qualification. The backend's
 * allowlist takes all three, so this is a choice rather than a constraint.
 */
export function squareToPng(image: HTMLImageElement, crop: CropWindow): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_PIXELS
  canvas.height = AVATAR_PIXELS

  const context = canvas.getContext("2d")

  if (!context) {
    return Promise.reject(new Error("This browser would not provide a drawing surface."))
  }

  context.imageSmoothingQuality = "high"
  context.drawImage(image, crop.x, crop.y, crop.side, crop.side, 0, 0, AVATAR_PIXELS, AVATAR_PIXELS)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error("The cropped image could not be encoded."))
    }, "image/png")
  })
}
