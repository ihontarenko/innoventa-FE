import type { Directory, FileLibraryPort, ManagedFile } from "@jmouse/files"
import { directoriesApi, fileLinks, fileOwner, filesApi } from "@/api/files"

/**
 * Innoventa's half of `@jmouse/files` — how the shared manager reaches this product (`INVT-0096`).
 *
 * ⚠️ **The package deliberately fetches nothing.** Three products authenticate differently and one of
 * them is called cross-origin by the other two; an HTTP client baked into the component would have
 * decided that for all three. So the component calls these, and these are Innoventa's `http`.
 *
 * ⚠️ **The three optional members are where this product genuinely differs**, not where it is being
 * fussy:
 *
 * <ul>
 *   <li><strong>`thumbnailUrl` / `openUrl` / `shareUrl`</strong> all come from a Sharing Center token.
 *       A file with none has no public route at all here — {@code /_/file/null} is worse than nothing —
 *       so they answer null and the manager draws the type's glyph. Kiwi answers these differently
 *       because its files are reachable only while a published page points at them;
 *   <li><strong>`importFrom`</strong> is present because this installation turns the library's import
 *       route on. It is the SERVER fetching an address on somebody's behalf, and the backend refuses
 *       loopback, site-local and link-local addresses — for every address the host resolves to, not the
 *       first. A product that leaves the route off simply omits this and gets no control.
 * </ul>
 *
 * ⚠️ **A `viewToken` is not on `ManagedFile`.** It is a Sharing Center row that happens to point at a
 * file, and the library knows nothing about it — which is why the token is looked up here rather than
 * expected on the payload the manager holds.
 */
export function innoventaFileLibrary(tokensByFileId: Map<string, string> = new Map()): FileLibraryPort {
  function tokenOf(file: ManagedFile): string | null {
    return tokensByFileId.get(file.id) ?? null
  }

  return {
    subtree: (directoryId) =>
      directoriesApi.subtree(directoryId).then((response) => response.data as Directory[]),

    filesIn: (directoryId) =>
      filesApi.list(fileOwner.directory(directoryId)).then((response) => response.data),

    // ⚠️ Through this product's own client, never the share link. A view token exists only for a file
    // somebody has published through the Sharing Center, and the cabinet is full of files that have
    // none — the viewer must work for those too, so it goes to the authenticated content route.
    bytes: (file) => filesApi.content(file.id).then((response) => response.data),

    upload: (directoryId, file, onProgress) =>
      filesApi.upload(fileOwner.directory(directoryId), file, onProgress).then((response) => response.data),

    importFrom: (directoryId, url) =>
      filesApi.importFrom(fileOwner.directory(directoryId), url).then((response) => response.data),

    createDirectory: (parentId, name) =>
      directoriesApi.create(parentId, name).then((response) => response.data as Directory),

    renameDirectory: (directoryId, name) =>
      directoriesApi.rename(directoryId, name).then((response) => response.data as Directory),

    // ⚠️ Never with the subtree — the backend refuses a folder that still holds something, and being
    // refused is the right answer.
    deleteDirectory: (directoryId) => directoriesApi.delete(directoryId).then(() => undefined),

    renameFile: (fileId, name) => filesApi.rename(fileId, name).then((response) => response.data),

    refileFile: (fileId, directoryId) =>
      filesApi.refile(fileId, directoryId).then((response) => response.data),

    deleteFile: (fileId) => filesApi.delete(fileId).then(() => undefined),

    thumbnailUrl: (file) => {
      const token = tokenOf(file)

      return token ? fileLinks.view(token) : null
    },

    openUrl: (file) => {
      const token = tokenOf(file)

      return token ? fileLinks.viewer(token) : null
    },

    /*
      ⚠️ **The branded page, not the bytes.** This answered `absoluteView` — `/_/file/{token}` — which is
      the address an `<img>` or an embed points at. Handed to a person it drops them into a raw PDF with
      no header, no name and no way back, while `openUrl` two seams above already used the viewer. One
      file, two "where is it" answers that disagreed.
    */
    shareUrl: (file) => {
      const token = tokenOf(file)

      return token ? fileLinks.absoluteViewer(token) : null
    },
  }
}
