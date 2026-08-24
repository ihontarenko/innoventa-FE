/**
 * Turning a chosen region of an image into the bytes that get uploaded.
 *
 * ⚠️ **The crop happens in the browser, before the upload.** That is what makes the field's
 * `image.max_width` / `image.max_height` configuration mean something — the server stores what it is
 * given, so an uncropped upload is an uncropped image forever.
 */

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const FORMAT_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
}

const FORMAT_EXTENSION: Record<string, string> = {
  jpeg: ".jpg",
  jpg: ".jpg",
  webp: ".webp",
  png: ".png",
}

export function extensionForFormat(format: string): string {
  return FORMAT_EXTENSION[format.toLowerCase()] ?? ".jpg"
}

/** The image configuration a field carries, read from its `configs` map. */
export interface ImageProcessing {
  crop: boolean
  maxWidth: number | null
  maxHeight: number | null
  format: string
  quality: number
}

export function imageProcessingOf(configs: Record<string, string>): ImageProcessing {
  const asInteger = (key: string) => {
    const parsed = Number.parseInt(configs[key] ?? "", 10)

    return Number.isNaN(parsed) ? null : parsed
  }

  const quality = Number.parseFloat(configs["image.quality"] ?? "")

  return {
    crop: configs["image.crop"] === "true",
    maxWidth: asInteger("image.max_width"),
    maxHeight: asInteger("image.max_height"),
    format: (configs["image.format"] ?? "jpeg").toLowerCase(),
    quality: Number.isNaN(quality) ? 0.92 : quality,
  }
}

/**
 * @param outputWidth  the size to scale the crop to — the field's configured maximum, or the crop's
 *                     own size when it has none
 *
 * ⚠️ **Quality is omitted for PNG**, which is lossless: passing one makes some browsers silently
 * re-encode to a different format instead of ignoring it.
 */
export async function croppedBlobOf(
  imageSource: string,
  cropArea: CropArea,
  { maxWidth, maxHeight, format, quality }: Pick<ImageProcessing, "maxWidth" | "maxHeight" | "format" | "quality">,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const canvasWidth = maxWidth ?? cropArea.width
      const canvasHeight = maxHeight ?? cropArea.height
      const canvas = document.createElement("canvas")

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      const context = canvas.getContext("2d")

      if (!context) {
        reject(new Error("Canvas context unavailable"))
        return
      }

      context.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, canvasWidth, canvasHeight)

      const mimeType = FORMAT_MIME[format] ?? "image/jpeg"

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas produced no image"))),
        mimeType,
        format === "png" ? undefined : quality,
      )
    }

    image.onerror = () => reject(new Error("That image could not be read"))
    image.src = imageSource
  })
}
