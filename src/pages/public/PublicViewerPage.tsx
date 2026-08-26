import { useParams } from "react-router-dom"
import { Download, ExternalLink, FileText } from "lucide-react"
import { Button, Skeleton } from "@jmouse/ui"
import { PoweredBy, PublicAccessError, PublicSurface } from "@/components/public/PublicSurface"
import { usePublicFile } from "@/hooks/usePublic"

/**
 * A file somebody was handed a link to.
 *
 * ⚠️ **The branded page, not the bytes.** `/_/file/{token}` already serves the file itself and always
 * did; what was missing was somewhere to *land* — a page that says what this is, who it came from and
 * offers a download, instead of dropping a visitor into a raw PDF with no way back. The backend has
 * pointed shared files at `/_/viewer` since sharing was built (`FileResourceDescriptor`), and
 * `fileLinks.viewer()` has been minting the address; the route simply never existed in this interface,
 * so every such link fell through to the application's own not-found.
 *
 * ⚠️ **What is shown is decided by the MIME type the server reports, never by the file name.** A `.bin`
 * called `report.pdf` gets an honest download button rather than an empty frame, and an image served as
 * `application/octet-stream` is offered rather than drawn broken.
 *
 * ⚠️ **Nothing is fetched by this page except the metadata.** The bytes are loaded by the browser from
 * the backend's own route — an `<iframe>` or an `<img>` — because that route is unauthenticated by
 * design and streams or redirects to the storage provider. Pulling them through the SPA would put a
 * hundred-megabyte PDF in a JavaScript promise for no gain.
 */
export function PublicViewerPage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const { data: file, isLoading, isError } = usePublicFile(shareToken)

  if (isLoading) {
    return (
      <PublicSurface>
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PublicSurface>
    )
  }

  if (isError || !file) {
    return <PublicAccessError what="file" />
  }

  const isPdf = file.mimeType === "application/pdf"
  const isImage = file.mimeType.startsWith("image/")
  const isText = file.mimeType.startsWith("text/")

  return (
    <PublicSurface wide>
      <div className="flex w-full flex-col gap-4">
        <div className="overflow-hidden rounded-lg border bg-background">
          <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" />

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="text-xs text-muted-foreground">
                {humanType(file.mimeType)} · {humanSize(file.fileSize)}
              </span>
            </div>

            <Button asChild size="sm" variant="outline">
              <a href={file.contentUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>

            {/* ⚠️ The backend's own download route, not `<a download>` on the inline one. The header it
                sets is what makes a browser save rather than render, and the attribute is ignored the
                moment the bytes come back as a redirect to a storage provider. */}
            <Button asChild size="sm">
              <a href={`${file.contentUrl}/download`}>
                <Download className="size-3.5" />
                Download
              </a>
            </Button>
          </header>

          {isPdf || isText ? (
            /* ⚠️ A `title` is not decoration: an untitled frame is announced as "frame" and nothing
               else, which is the whole of what a screen reader gets from this element. */
            <iframe
              src={file.contentUrl}
              title={file.fileName}
              className="h-[75svh] min-h-[420px] w-full border-0 bg-muted"
            />
          ) : isImage ? (
            /* ⚠️ A light ground whatever the visitor's theme. Photographs of parts are cut out on white,
               so on a dark surface they arrive as a white rectangle with a bevel around it. */
            <div className="grid min-h-[320px] place-items-center bg-white p-6 dark:bg-zinc-100">
              <img
                src={file.contentUrl}
                alt={file.fileName}
                className="max-h-[70svh] w-auto max-w-full object-contain"
              />
            </div>
          ) : (
            /* ⚠️ **Not an apology, and not an empty frame.** A format this browser cannot show is the
                ordinary case for a CAD file or an archive, and the page's job then is to hand the bytes
                over rather than to look broken. */
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span aria-hidden="true" className="text-3xl">
                📦
              </span>
              <span className="text-sm font-medium">Nothing to show it with</span>
              <span className="max-w-sm text-xs text-muted-foreground">
                A {humanType(file.mimeType)} is not something a browser can draw. Download it and open it
                with whatever made it.
              </span>
            </div>
          )}
        </div>

        <PoweredBy />
      </div>
    </PublicSurface>
  )
}

/** ⚠️ The subtype, upper-cased — `application/pdf` reads as PDF, which is what anybody calls it. */
function humanType(mimeType: string): string {
  if (!mimeType) {
    return "File"
  }

  const slash = mimeType.indexOf("/")

  return (slash >= 0 ? mimeType.slice(slash + 1) : mimeType).toUpperCase()
}

function humanSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
