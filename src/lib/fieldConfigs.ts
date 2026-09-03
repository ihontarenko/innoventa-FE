import type { FieldDetail } from "@/types"

/**
 * The configuration keys the runtime reads, named once.
 *
 * ⚠️ **The old interface has a `FieldConfigs` class with thirty getters** covering image processing,
 * inventory behaviour and more. It is not ported wholesale: a key arrives here with the screen that
 * reads it, so this file stays a list of what is actually used rather than a catalogue of what exists.
 */
export const FIELD_CONFIG_KEYS = {
  /** The line under a control — what to type, in the form author's words. */
  DISPLAY_HINT: "display.hint",
} as const

/**
 * What a field asks of a picture on its way in.
 *
 * ⚠️ **Read in one place and written in one place**, which is the whole reason they are named here
 * rather than spelled out in each: `imageProcessing` turns them into a cropper specification and the
 * editor's *Picture* card is the only screen that sets them. They were raw strings in the first of
 * those and had a control on neither — see that card's own note.
 */
export const IMAGE_CONFIG_KEYS = {
  /** `required` · `offered` (the default) · `off`. */
  CROP: "image.crop",
  /** The shapes the cropper offers — a list, or `none`. Silence offers all of them. */
  RATIOS: "image.ratios",
  /** `false` takes away the corner grips. */
  RESHAPE: "image.reshape",
  MAX_WIDTH: "image.max_width",
  MAX_HEIGHT: "image.max_height",
  /** `png` · `jpeg` · `webp`. Silence keeps whatever was uploaded. */
  FORMAT: "image.format",
  /** 0–1, and ignored for PNG. */
  QUALITY: "image.quality",
} as const

/**
 * The help line under a field: the author's configured hint first, then the field's own description.
 *
 * ⚠️ A configured hint wins because it was written *for the person filling the form*, while a
 * description is often written for whoever maintains the schema.
 */
export function displayHintOf(field: FieldDetail): string | null {
  return field.configs[FIELD_CONFIG_KEYS.DISPLAY_HINT] || field.description || null
}
