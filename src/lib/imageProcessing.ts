import {
  COMMON_RATIOS,
  keepingFormatOf,
  type CropRatio,
  type ImageCropSpecification,
  type ImageFormat,
} from "@jmouse/ui"
import { IMAGE_CONFIG_KEYS } from "./fieldConfigs"

/**
 * What a field asks of a picture, and how that reaches the shared cropper.
 *
 * ⚠️ **Reading a field's configuration is Innoventa's, cropping is not.** The `image.*` keys are this
 * product's vocabulary — a form builder writes them, nothing else in the workspace has them — so
 * translating them lives here. The cropping itself is `@jmouse/ui`'s `ImageCropper`, which three
 * products share; this file is the adapter between the two and holds no canvas code at all.
 *
 * ⚠️ **The crop happens in the browser, before the upload.** That is what makes `image.max_width` /
 * `image.max_height` mean something — the server stores what it is given, so an uncropped upload is an
 * uncropped image forever.
 */

/**
 * Whether a picture is framed on its way into a field, and whether the person may decline.
 *
 * ⚠️ **`offered` is the default, and that is the whole point of the three states.** `image.crop` is set
 * on no field in this installation, and until the field editor grew its *Picture* card it had a control
 * on no screen either — so a two-state flag defaulting to off meant every dynamic form in the product
 * silently had no cropper at all. A picture somebody attaches to a form is a picture they may want to
 * trim; the offer costs one dismissible dialog and is skippable, and the original goes up untouched
 * when it is skipped. The card is where a field says otherwise; the default stands for every field
 * that never does.
 */
export type CropDemand = "required" | "offered" | "off"

/** The image configuration a field carries, read from its `configs` map. */
export interface ImageProcessing {
  crop: CropDemand
  maxWidth: number | null
  maxHeight: number | null
  /** ⚠️ `null` means the field named none — which is not the same as naming JPEG. */
  format: string | null
  quality: number
  /**
   * The shapes the field offers while framing. `null` offers none — see {@link cropSpecificationFor}
   * for the one case where that is decided rather than configured.
   */
  ratios: CropRatio[] | null
  /** Whether a corner may be dragged to a shape the field did not list. */
  reshape: boolean
}

export function imageProcessingOf(configs: Record<string, string>): ImageProcessing {
  const asInteger = (key: string) => {
    const parsed = Number.parseInt(configs[key] ?? "", 10)

    return Number.isNaN(parsed) ? null : parsed
  }

  const quality = Number.parseFloat(configs[IMAGE_CONFIG_KEYS.QUALITY] ?? "")

  return {
    crop: cropDemandOf(configs[IMAGE_CONFIG_KEYS.CROP]),
    maxWidth: asInteger(IMAGE_CONFIG_KEYS.MAX_WIDTH),
    maxHeight: asInteger(IMAGE_CONFIG_KEYS.MAX_HEIGHT),
    format: configs[IMAGE_CONFIG_KEYS.FORMAT]?.toLowerCase() || null,
    quality: Number.isNaN(quality) ? 0.92 : quality,
    ratios: ratiosOf(configs[IMAGE_CONFIG_KEYS.RATIOS]),
    reshape: configs[IMAGE_CONFIG_KEYS.RESHAPE] !== "false",
  }
}

/**
 * Which shapes a field offers, written as a list — `original, square, 16:9` — or left unsaid.
 *
 * ⚠️ **Silence means all of them, not none.** Every dynamic field in this installation names no image
 * configuration at all (which is the same reason `image.crop` defaults to *offered*), so a key that
 * had to be typed in before the ratios appeared would be a control nobody ever saw. The shape of a
 * picture somebody is attaching is theirs; a field takes it away only by saying so.
 *
 * ⚠️ **`none` is how a field says so, and it is not the same as an empty string.** An empty value is a
 * key somebody cleared, which should behave as though it were never set.
 */
function ratiosOf(configured: string | undefined): CropRatio[] | null {
  const written = configured?.trim().toLowerCase()

  if (!written) {
    return COMMON_RATIOS
  }

  if (written === "none") {
    return null
  }

  const named = written
    .split(",")
    .map((token) => ratioOf(token.trim()))
    .filter((ratio): ratio is CropRatio => ratio !== null)

  return named.length > 0 ? named : COMMON_RATIOS
}

/** One token of `image.ratios` — a name the shared list already knows, or a bare `width:height`. */
function ratioOf(token: string): CropRatio | null {
  const known = COMMON_RATIOS.find((ratio) => ratio.label.toLowerCase() === token)

  if (known) {
    return known
  }

  const [width, height] = token.split(":").map(Number)

  if (!width || !height || width < 0 || height < 0) {
    return null
  }

  return { label: `${width}:${height}`, aspect: width / height }
}

/**
 * ⚠️ **`false` still means no crop step at all**, which is the promise this key made before it had
 * three states: a field configured to skip the framing keeps skipping it. What changed is what
 * *silence* means — it used to mean the same as `false`, and now it means the offer.
 */
function cropDemandOf(configured: string | undefined): CropDemand {
  if (configured === "true" || configured === "required") {
    return "required"
  }

  if (configured === "false" || configured === "off") {
    return "off"
  }

  return "offered"
}

/**
 * The field's values, said in the cropper's own vocabulary.
 *
 * ⚠️ **The ratio is not passed and that is deliberate.** `cropSpecificationOf` derives it from the two
 * output dimensions when both are given — a field configured for 400×300 thumbnails cannot then be
 * handed a portrait region that every screen would squash. A field naming only one dimension, or
 * neither, gets a frame the picture's own shape, which is the honest default when nobody said.
 *
 * ⚠️ **And a field that names BOTH dimensions offers no shapes either, whatever it configured.** The
 * two numbers are that field saying *this slot is exactly this shape*; a row of ratios above it would
 * be offering to break the thing the field was measured for. Every other field lets the person choose,
 * because the picture's shape is then theirs and nothing downstream depends on it.
 *
 * ⚠️ **A field that names no format keeps the picture's own.** Re-encoding is a change the person
 * accepting a crop did not ask for and cannot see: a 400 kB JPEG photograph arriving as a
 * six-megabyte PNG, or a screenshot's flat colour arriving with JPEG ringing around every letter. Only
 * an explicit `image.format` overrides what was uploaded.
 */
export function cropSpecificationFor(
  processing: ImageProcessing,
  picture: File,
): Partial<ImageCropSpecification> {
  const shapeIsTheFieldsOwn = processing.maxWidth !== null && processing.maxHeight !== null

  const asked: Partial<ImageCropSpecification> = {
    shape: "rectangle",
    outputWidth: processing.maxWidth,
    outputHeight: processing.maxHeight,
    quality: processing.quality,
    ratios: shapeIsTheFieldsOwn ? null : processing.ratios,
    resizable: !shapeIsTheFieldsOwn && processing.reshape,
  }

  if (processing.format) {
    return { ...asked, format: formatOf(processing.format) }
  }

  // PNG rather than JPEG for a source the cropper cannot write back — a GIF, an AVIF — because those
  // are as likely to be flat colour as a photograph, and PNG is the one that does not ruin either.
  return keepingFormatOf(picture, { ...asked, format: "png" })
}

const FORMATS: Record<string, ImageFormat> = {
  jpeg: "jpeg",
  jpg: "jpeg",
  png: "png",
  webp: "webp",
}

/** An unrecognised `image.format` becomes JPEG, which is what the field's own default already was. */
function formatOf(format: string): ImageFormat {
  return FORMATS[format] ?? "jpeg"
}
