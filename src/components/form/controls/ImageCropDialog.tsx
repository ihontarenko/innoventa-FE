import { useCallback, useState } from "react"
import Cropper from "react-easy-crop"
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@jmouse/ui"
import { croppedBlobOf, type CropArea, type ImageProcessing } from "@/lib/imageProcessing"

/**
 * Choosing the part of an image that gets uploaded.
 *
 * ⚠️ **Only shown when the field asks for it** (`image.crop`). A field that does not is uploaded as
 * chosen — putting everybody through a crop step is how a photo field becomes slower than attaching a
 * file.
 *
 * ⚠️ **The aspect ratio comes from the field's own maximum width and height**, so a field configured
 * for 400×300 thumbnails cannot be handed a portrait crop that will be squashed on every screen that
 * shows it.
 */
export function ImageCropDialog({
  source,
  processing,
  onCropped,
  onCancel,
}: {
  source: string
  processing: ImageProcessing
  onCropped: (blob: Blob) => void
  onCancel: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<CropArea | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isWorking, setWorking] = useState(false)

  const onCropComplete = useCallback((_: unknown, croppedPixels: CropArea) => setArea(croppedPixels), [])

  const aspect =
    processing.maxWidth && processing.maxHeight ? processing.maxWidth / processing.maxHeight : undefined

  async function confirm() {
    if (!area) {
      return
    }

    setWorking(true)
    setError(null)

    try {
      onCropped(await croppedBlobOf(source, area, processing))
    } catch {
      setError("That crop could not be produced. Try a different area.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop the image</DialogTitle>
          <DialogDescription>
            {processing.maxWidth && processing.maxHeight
              ? `Saved at ${processing.maxWidth}×${processing.maxHeight}.`
              : "Saved at the size you choose."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-80 w-full overflow-hidden rounded-md bg-muted">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!area || isWorking} onClick={() => void confirm()}>
            {isWorking ? "Working…" : "Use this crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
