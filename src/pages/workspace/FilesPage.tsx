import { useMemo } from "react"
import { toast } from "sonner"
import { FileManager } from "@jmouse/files"
import { PageHeader } from "@/components/PageHeader"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { INERT_SURFACE } from "@/components/markdown/surface"
import { useCabinetRoot } from "@/hooks/useFiles"
import { innoventaFileLibrary } from "@/lib/fileLibraryPort"

/**
 * Files — the account's own cabinet, on the shared file library.
 *
 * ⚠️ **Reworked, then EXTRACTED (`INVT-0063`, then `UIK-7`/`INVT-0096`).** The first rework moved files
 * out of Innoventa's category tree and onto the library's directories. This one moves the screen itself
 * out of Innoventa: the manager is `@jmouse/files` now, and Kiwi and Tessera mount the same one.
 *
 * ⚠️ **Which makes this page three things and nothing else** — the header, the root, and the port. That
 * is the whole of what was ever Innoventa's about it:
 *
 * <ul>
 *   <li><strong>the root</strong> comes from the PROFILE, not from listing. `GET /directories` answers
 *       per owner and a root is filed under nothing, so it comes back empty however it is asked —
 *       `filesRootId` on `/auth/me` is the way in. Every account has a cabinet of its own here, which is
 *       exactly why the shared component takes the root as a prop rather than discovering it;
 *   <li><strong>the port</strong> is Innoventa's client over the library's routes, including the two
 *       seams no other product answers the same way: a Sharing Center token is what makes a file's bytes
 *       reachable, and importing from a URL is turned on here;
 *   <li><strong>the notice</strong> is `sonner`, because the package deliberately picks no toast library.
 * </ul>
 *
 * ⚠️ **`DirectoryTree`, `FileList`, `FileRows`, `FileTiles`, `FileThumbnail`, `FolderGlyph`,
 * `useFileActions` and `lib/fileDisplay` are GONE from this repository.** They are the package's. If
 * something here needs changing, change it there — a copy taken back would start drifting on its first
 * edit, and the products would disagree about a screen they are supposed to share.
 */
export function FilesPage() {
  const { data: rootId, isLoading, isError } = useCabinetRoot()

  // ⚠️ Memoised, and it matters: the manager loads the tree in an effect keyed on the port, so a new
  // object every render would refetch on every render.
  const port = useMemo(() => innoventaFileLibrary(), [])

  if (isError) {
    return (
      <>
        <PageHeader title="Files" />
        <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
          This account has no file cabinet yet. It is made on first use — upload something anywhere in the
          product and it will appear.
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Files" description="Everything you have kept" />

      <FileManager
        rootId={isLoading ? null : rootId ?? null}
        port={port}
        rootLabel="My files"
        // ⚠️ The OLD interface's key, deliberately: somebody who chose tiles in the interface being
        // replaced finds tiles in the one replacing it. Two keys would make the port feel like it forgot.
        layoutStorageKey="innoventa.files.view"
        // ⚠️ The ONE thing about looking at a file that is still this product's, and it is a setting
        // rather than a screen: the viewer, what it can draw and what it refuses all belong to the
        // package.
        //
        // ⚠️ **`INERT_SURFACE`, not `APP_SURFACE`, and the difference matters.** A `.md` in the cabinet
        // is a file somebody uploaded, not a page somebody wrote here — its `:::` blocks would otherwise
        // be resolved against this account's own parts and stock on the strength of whatever text
        // happened to be inside an attachment. The client directives — mermaid, callouts, KaTeX — still
        // render, which is all a note needs.
        renderMarkdown={(markdown) => <PageMarkdown markdown={markdown} surface={INERT_SURFACE} dense />}
        onNotice={(message) => toast.error(message)}
        emptyHint="Nothing filed here yet. Drag a file onto a folder to move it there."
      />
    </>
  )
}
