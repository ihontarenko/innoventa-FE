import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Skeleton } from "@jmouse/ui"
import { fileLinks, type FileWithLink } from "@/api/files"
import { useMyFiles } from "@/hooks/useFiles"

/**
 * Attaching a file the workspace already has.
 *
 * ⚠️ **The reason this exists is that a file is not a copy.** The same datasheet is attached to forty
 * entries; uploading it again would store it forty times and leave forty things to update when it
 * changes.
 */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp)$/i

export function ExistingFilePicker({
  acceptImages,
  onPick,
  onClose,
}: {
  acceptImages: boolean
  onPick: (file: FileWithLink) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const { data, isLoading } = useMyFiles()

  // ⚠️ Filtered in the browser, over one folder's contents. The paging controls went with INVT-0063:
  // this is a directory's contents now rather than a page of an account-wide query, and pretending to
  // page through a folder would be two controls disagreeing about what "next" means. A server-side
  // search across the whole cabinet is the file manager's job (INVT-0054), not this dialog's.
  const files = (data ?? [])
    .filter((file) => !acceptImages || IMAGE_EXTENSIONS.test(file.name))
    .filter((file) => !search.trim() || file.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a file</DialogTitle>
          <DialogDescription>Attaching one links to it — it is not copied.</DialogDescription>
        </DialogHeader>

        <Input placeholder="Search this page…" value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {isLoading && [0, 1, 2].map((placeholder) => <Skeleton key={placeholder} className="h-20" />)}

          {!isLoading && files.length === 0 && (
            <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
              Nothing here{search ? " under that search" : " yet"}.
            </p>
          )}

          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => onPick(file)}
              className="flex flex-col gap-1 rounded-md border p-2 text-left hover:bg-accent"
            >
              {IMAGE_EXTENSIONS.test(file.name) && file.viewToken ? (
                <img
                  src={fileLinks.view(file.viewToken)}
                  alt=""
                  className="h-16 w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-16 w-full items-center justify-center rounded bg-muted text-xs uppercase">
                  {file.name.split(".").pop()}
                </span>
              )}
              <span className="truncate text-xs" title={file.name}>
                {file.name}
              </span>
            </button>
          ))}
        </div>

        {/*
          ⚠️ The paging controls are gone with INVT-0063, not forgotten. The list is a directory's
          contents now rather than a page of an account-wide query, and pretending to page through a
          folder would be two controls that disagree about what "next" means. Browsing folders — and a
          server-side search over them — is the file manager's job (INVT-0054), not this dialog's.
        */}
      </DialogContent>
    </Dialog>
  )
}
