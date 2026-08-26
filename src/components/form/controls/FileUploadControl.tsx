import { useMemo, useRef, useState } from "react"
import { ExternalLink, FolderOpen, Upload, X } from "lucide-react"
import { Button, ImageCropperDialog, cn, isCroppableImage } from "@jmouse/ui"
import { composeFileFieldValue, fileLinks, parseFileFieldValue } from "@/api/files"
import { cropSpecificationFor, imageProcessingOf } from "@/lib/imageProcessing"
import { useUploadFile } from "@/hooks/useFiles"
import { useUploadDestination } from "@/components/form/UploadDestination"
import { usePublicConfiguration } from "@/hooks/useSystemSettings"
import { ExistingFilePicker } from "./ExistingFilePicker"
import type { ControlProperties } from "./types"

/**
 * Attaching a file, or a picture.
 *
 * ⚠️ **The stored value is `token:filename`, not an id and not a URL.** The token is what makes the
 * file readable without a session, which is what a public form needs; the filename rides along so a
 * listing can name the attachment without fetching it. `api/files.ts` owns that shape.
 *
 * ⚠️ **A file with no view token cannot be attached at all** — it would be a reference nothing can
 * open. Said out loud rather than stored and discovered later.
 */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp)$/i
const VIEWABLE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|pdf|txt|csv|md)$/i

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.svg"
const FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.txt,.csv,.zip,.xlsx,.docx"

export function FileUploadControl({ field, value, onChange, hasError, acceptImages = false }: ControlProperties & { acceptImages?: boolean }) {
  const inputReference = useRef<HTMLInputElement>(null)
  const { data: publicConfig } = usePublicConfiguration()
  const uploadFile = useUploadFile()

  // ⚠️ Where this form.s uploads belong. Undefined for a form that belongs to no feature — a public
  // fill, a one-off — and that keeps landing in the cabinet exactly as it always did.
  const rootName = useUploadDestination()

  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [isPicking, setPicking] = useState(false)

  /**
   * The picture waiting to be framed.
   *
   * ⚠️ **The file itself, not an object URL of it.** The cropper decodes and releases what it is
   * given, so handing it the file removes the revoke this component used to have to remember — and it
   * means the crop comes back named after the original with the encoded format's extension, rather
   * than as something this component has to rebuild the name for.
   */
  const [cropping, setCropping] = useState<File | null>(null)

  const maximumMegabytes = Number.parseInt(publicConfig?.["files.max_size_mb"] ?? "50", 10)
  const processing = imageProcessingOf(field.configs)

  // Held steady across renders: the cropper re-derives its frame from whatever specification it is
  // handed, so a fresh object every render is a frame that never settles.
  const cropSpecification = useMemo(
    () => (cropping ? cropSpecificationFor(processing, cropping) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the picture and the four values are the identity here
    [cropping, processing.maxWidth, processing.maxHeight, processing.format, processing.quality],
  )

  const reference = parseFileFieldValue(value)
  const filename = reference ? reference.filename : value
  const url = reference ? fileLinks.view(reference.viewToken) : null
  const isImage = !!filename && IMAGE_EXTENSIONS.test(filename)
  const isViewable = !!filename && VIEWABLE_EXTENSIONS.test(filename)

  async function uploadBlob(blob: Blob, name: string) {
    setProgress(0)

    try {
      const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type || "image/jpeg" })
      const uploaded = await uploadFile.mutateAsync({ file, rootName, onProgress: setProgress })

      if (!uploaded.viewToken) {
        setError("That upload has no public link, so it cannot be attached here.")
        return
      }

      onChange(composeFileFieldValue(uploaded.viewToken, uploaded.name))
      setError("")
    } catch (uploadError: unknown) {
      const detail = (uploadError as { response?: { data?: { detail?: string } } })?.response?.data?.detail

      setError(detail ?? "The upload failed. Try again.")
    } finally {
      setProgress(null)

      // ⚠️ Cleared so choosing the same file twice fires a change event the second time as well.
      if (inputReference.current) {
        inputReference.current.value = ""
      }
    }
  }

  function onFileChosen(chosen: File | undefined) {
    if (!chosen) {
      return
    }

    if (chosen.size > maximumMegabytes * 1024 * 1024) {
      setError(`That file is too large — the limit is ${maximumMegabytes} MB.`)
      return
    }

    if (acceptImages && !chosen.type.startsWith("image/")) {
      setError("Only images can be attached here.")
      return
    }

    setError("")

    // ⚠️ **Every picture on every dynamic form, not only a field that was configured for it.** There
    // is one `DynamicForm` behind the entry dialogs, the public form, the embed and the builder's
    // preview, so this branch is the whole product's answer to "may I frame this before it goes up" —
    // and `image.crop` has a control on no screen, so waiting to be asked meant never being asked.
    // `required` is the field insisting; silence is the offer; `off` is the field opting out.
    //
    // ⚠️ Gated on `isCroppableImage`, not on `image/`: SVG passes the second test and must never take
    // this branch, because framing it means handing back a raster of the one thing that was not one.
    if (processing.crop !== "off" && isCroppableImage(chosen)) {
      setCropping(chosen)

      if (inputReference.current) {
        inputReference.current.value = ""
      }

      return
    }

    void uploadBlob(chosen, chosen.name)
  }

  if (reference) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border p-2", hasError && "border-destructive")}>
        {isImage && url ? (
          <img src={url} alt={filename} className="size-12 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted text-xs uppercase">
            {filename.split(".").pop()}
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-sm" title={filename}>
          {filename}
        </span>

        {isViewable && url && (
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Open">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}

        {/* ⚠️ Detaches, never deletes. The file belongs to the workspace's library and may be attached
            somewhere else too — removing it from storage from inside a form would take it from there. */}
        <Button type="button" variant="ghost" size="icon" aria-label="Detach" onClick={() => onChange("")}>
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputReference}
          type="file"
          className="sr-only"
          accept={field.attributes["accept"] ?? (acceptImages ? IMAGE_ACCEPT : FILE_ACCEPT)}
          onChange={(event) => onFileChosen(event.target.files?.[0])}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={progress !== null}
          onClick={() => inputReference.current?.click()}
        >
          <Upload className="size-3.5" />
          {progress === null ? (acceptImages ? "Upload an image" : "Upload a file") : `${progress}%`}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
          <FolderOpen className="size-3.5" />
          Choose existing
        </Button>

        {value && !reference && (
          <span className="truncate font-mono text-xs text-muted-foreground" title={value}>
            {value}
          </span>
        )}
      </div>

      {progress !== null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}

      {/* ⚠️ The description is left to the dialog in both cases: it says what the result will be saved
          at, read from the field's own configuration, and that is the one fact that changes how
          generously somebody frames a picture. */}
      <ImageCropperDialog
        open={cropping !== null}
        onOpenChange={(next) => !next && setCropping(null)}
        source={cropping}
        specification={cropSpecification}
        skippable={processing.crop === "offered"}
        busy={progress !== null}
        onCropped={(cropped) => {
          setCropping(null)
          void uploadBlob(cropped, cropped.name)
        }}
        onSkipped={() => {
          const original = cropping

          setCropping(null)

          if (original) {
            void uploadBlob(original, original.name)
          }
        }}
        labels={
          processing.crop === "required"
            ? { title: "Crop the image" }
            : { title: "Trim the picture?", confirm: "Upload this crop", skip: "Upload as it is" }
        }
      />

      {isPicking && (
        <ExistingFilePicker
          acceptImages={acceptImages}
          onClose={() => setPicking(false)}
          onPick={(file) => {
            if (!file.viewToken) {
              setError("That file has no public link, so it cannot be attached here.")
              setPicking(false)
              return
            }

            onChange(composeFileFieldValue(file.viewToken, file.name))
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
