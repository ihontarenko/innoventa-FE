import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button, cn } from "@jmouse/ui"
import { fileOwner, filesApi, type ManagedFile } from "@/api/files"
import { projectFilesApi } from "@/api/projectFiles"
import { relativeTime } from "@/lib/dates"

/**
 * A project's own files — the KiCad project, the gerbers, the reports, beside the bill of materials.
 *
 * <h2>⚠️ A section, not a tab, and that is a deliberate departure from the ticket</h2>
 *
 * <p>This screen has no tab strip: it is one column of sections — buildability, the tallies, what is
 * missing, the bill of materials. Adding a lone tab bar for one panel would introduce a second
 * navigation idea to a page that reads top to bottom, and put the files behind a click on a screen whose
 * whole argument is that everything about a project is visible at once.
 *
 * <h2>⚠️ The bytes go to the file library, not through the product</h2>
 *
 * <p>Innoventa answers one question — <em>which directory is this project's</em> — and every upload,
 * listing and deletion is {@code jmouse-storage-management}'s own route with that directory as the
 * owner. A second upload path through the product would be a second place for the size limit, the
 * allowed types and the quota to be decided, and the first to drift would do it silently.
 *
 * <h2>⚠️ The folder is made on the first upload, not on the first look</h2>
 *
 * <p>Opening a project must not create a directory. So the read asks for the folder and accepts "none
 * yet"; only pressing Upload asks for one to exist.
 */
export function ProjectFilesPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const folderQuery = useQuery({
    queryKey: ["project", projectId, "folder"],
    queryFn: () => projectFilesApi.folder(projectId).then((response) => response.data),
  })

  const directoryId = folderQuery.data?.directoryId ?? null

  const filesQuery = useQuery<ManagedFile[]>({
    queryKey: ["project", projectId, "files", directoryId],
    queryFn: () => filesApi.list(fileOwner.directory(directoryId!)).then((response) => response.data),
    enabled: Boolean(directoryId),
  })

  const files = filesQuery.data ?? []

  const remove = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId, "files"] }),
  })

  async function upload(chosen: FileList | null) {
    if (!chosen || chosen.length === 0) {
      return
    }

    setUploading(true)

    try {
      // ⚠️ Asked for here rather than on mount — this is the moment the folder has a reason to exist.
      const folder = await projectFilesApi.requireFolder(projectId).then((response) => response.data)

      for (const file of Array.from(chosen)) {
        await filesApi.upload(fileOwner.directory(folder.directoryId!), file)
      }

      await queryClient.invalidateQueries({ queryKey: ["project", projectId, "folder"] })
      await queryClient.invalidateQueries({ queryKey: ["project", projectId, "files"] })
      toast.success(chosen.length === 1 ? "File added." : `${chosen.length} files added.`)
    } catch (failure) {
      const problem = failure as { response?: { data?: { detail?: string } } }
      toast.error(problem.response?.data?.detail ?? "That could not be uploaded.")
    } finally {
      setUploading(false)

      if (picker.current) {
        picker.current.value = ""
      }
    }
  }

  return (
    <details className="rounded-md border" open={files.length > 0}>
      <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-medium">
        Files
        <span className="text-muted-foreground tabular-nums">{files.length}</span>
        {folderQuery.data?.path && (
          <span className="text-muted-foreground ml-auto truncate font-normal">
            {folderQuery.data.path}
          </span>
        )}
      </summary>

      <div className="border-t">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void upload(event.dataTransfer.files)
          }}
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs"
        >
          <span className="text-muted-foreground">
            KiCad project, gerbers, drill files, STEP, reports — anything the build needs, in one place.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <input
              ref={picker}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void upload(event.target.files)}
            />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => picker.current?.click()}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>

        {files.length === 0 ? (
          <p className="text-muted-foreground px-3 py-4 text-center text-xs">
            Nothing filed yet. Drop files here, or press Upload.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-[10px] uppercase tracking-[0.06em]">
                <th className="px-2.5 py-1.5 text-left font-medium">Name</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Size</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Added</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b last:border-b-0">
                  <td className="max-w-72 truncate px-2.5 py-1">
                    {/* ⚠️ **Fetched through the client, never a plain href.** The library's content route
                        is authenticated, so an anchor pointed at it carries no credentials and answers
                        401 — which renders to a person as "the file is missing". */}
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => void download(file)}
                    >
                      {file.name}
                    </button>
                    {/* ⚠️ Named for what it unlocks rather than for the extension: somebody looking at a
                        KiCad project on this screen is one step from a bill of materials they do not
                        have to type. */}
                    {file.name.endsWith(".kicad_pro") && (
                      <span className="text-muted-foreground ml-2 text-[11px]">
                        a BOM can be imported from this
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-2.5 py-1 text-[12px]">{file.contentType}</td>
                  <td className="px-2.5 py-1 text-right tabular-nums">{readableSize(file.sizeBytes)}</td>
                  <td className="text-muted-foreground px-2.5 py-1">{relativeTime(file.createdAt)}</td>
                  <td className="px-1 py-1 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className={cn(
                        "text-muted-foreground hover:text-destructive px-1 text-xs",
                        remove.isPending && "pointer-events-none opacity-50",
                      )}
                      onClick={() => remove.mutate(file.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  )
}

/**
 * Pulls the bytes through the authenticated client and hands them to the browser as a download.
 *
 * ⚠️ The object URL is revoked immediately after the click — a page that accumulates one per file
 * opened holds every one of those blobs in memory for as long as the tab is open.
 */
async function download(file: ManagedFile) {
  const bytes = await filesApi.content(file.id).then((response) => response.data)
  const address = URL.createObjectURL(bytes)
  const anchor = document.createElement("a")

  anchor.href = address
  anchor.download = file.name
  anchor.click()

  URL.revokeObjectURL(address)
}

/** ⚠️ Binary units, because that is what every other size in this product and in the OS reports. */
function readableSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024
    unit = unit + 1
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
