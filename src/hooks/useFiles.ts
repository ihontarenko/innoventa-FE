import { useMutation, useQuery } from "@tanstack/react-query"
import { authApi } from "@/api/auth"
import {
  fileOwner,
  filesApi,
  shareApi,
  type FileWithLink,
  type ManagedFile,
} from "@/api/files"

/**
 * This account's own file cabinet.
 *
 * ⚠️ **Two calls, on purpose.** Since `INVT-0063` the file routes are the shared library's, and a public
 * link is a Sharing Center row rather than a property of a file — so the list comes from one and the
 * links from the other, in one request for the whole page rather than one per row.
 */
export function useMyFiles(folder?: FolderRequest) {
  return useQuery<FileWithLink[]>({
    queryKey: ["files", "mine", folder ? [folder.name, folder.type, folder.kind] : "cabinet"],
    queryFn: async () => {
      /*
        ⚠️ **The root has to match where uploads go, or "choose existing" cannot see them.** Once a
        feature's uploads land in their own root, a picker still listing the cabinet shows everything
        except the files somebody just added — which reads as the upload having failed.
      */
      const directory = folder ? await folderId(folder) : await cabinetId()

      const files = await filesApi
        .list(fileOwner.directory(directory))
        .then((response) => response.data)

      return withLinks(files)
    },
  })
}

/** The files in one folder, with their public links. */
export function useFilesIn(directoryId: string | null) {
  return useQuery<FileWithLink[]>({
    queryKey: ["files", "directory", directoryId],
    enabled: Boolean(directoryId),
    queryFn: async () => {
      const files = await filesApi
        .list(fileOwner.directory(directoryId as string))
        .then((response) => response.data)

      return withLinks(files)
    },
  })
}

/**
 * ⚠️ **Deliberately not invalidating the file list.** An upload from inside a form is about that field;
 * refetching every page of a file manager that may not even be mounted is work nobody asked for. The
 * list refetches when somebody opens it.
 */
export function useUploadFile() {
  return useMutation<
    FileWithLink,
    unknown,
    {
      file: File
      directoryId?: string
      /**
       * ⚠️ **Which named root this belongs in** — `inventory`, `cad`. Resolved on the server, which
       * creates it on first ask, so nothing here has to know a path.
       */
      folder?: FolderRequest
      onProgress?: (percent: number) => void
    }
  >({
    mutationFn: async ({ file, directoryId, folder, onProgress }) => {
      // ⚠️ A file has to go SOMEWHERE — the library files against an owner, and there is no such thing
      // as an unfiled file. An explicit folder wins; a named root is what a feature's own form asks for;
      // and the cabinet is the last answer, for a fill that belongs to no feature at all.
      const destination = directoryId ?? (folder ? await folderId(folder) : await cabinetId())

      const stored = await filesApi
        .upload(fileOwner.directory(destination), file, onProgress)
        .then((response) => response.data)

      return withLinks([stored]).then((withToken) => withToken[0])
    },
  })
}

/**
 * A file this installation fetches for somebody, from an address rather than from their disk.
 *
 * ⚠️ **The SERVER does the fetching, and that is the whole reason this exists.** A distributor's PDF is
 * on somebody else's origin with no CORS headers, so a browser cannot read the bytes at all — it can
 * only open the link in a tab. Keeping a copy therefore has to be asked of the backend, which refuses
 * loopback, site-local and link-local addresses for every address the host resolves to.
 *
 * ⚠️ **It lands in the account's own cabinet when no folder is named**, exactly like a form upload.
 */
export function useImportFile() {
  return useMutation<FileWithLink, unknown, { url: string; directoryId?: string }>({
    mutationFn: async ({ url, directoryId }) => {
      const destination = directoryId ?? (await cabinetId())

      const stored = await filesApi
        .importFrom(fileOwner.directory(destination), url)
        .then((response) => response.data)

      return withLinks([stored]).then((withToken) => withToken[0])
    },
  })
}

/**
 * The caller's directory for one kind of file, made on the server the first time it is asked for.
 *
 * ⚠️ **Memoised for the session.** A root's id does not change once it exists, and an upload control
 * mounting on every row of a form would otherwise ask again per field.
 */
const folderIds = new Map<string, Promise<string>>()

/** Where one kind of file belongs: an allow-listed root, and up to two shelves inside it. */
export interface FolderRequest {
  name: string
  /** Which type the file is about — `Resistor`. */
  type?: string
  /** What sort of file it is — `Datasheets`, `Images`. */
  kind?: string
}

/**
 * ⚠️ **The whole request is the memo key, not the root name.** Keyed on the name alone, the second
 * type to upload anything would be handed the first type's folder id — and the file would land in
 * somebody else's shelf while every screen said it went where it was asked to.
 */
export function folderId(request: FolderRequest): Promise<string> {
  const key = [request.name, request.type ?? '', request.kind ?? ''].join('/')
  const known = folderIds.get(key)

  if (known) {
    return known
  }

  const asked = filesApi
    .folder(request.name, { type: request.type, kind: request.kind })
    .then((response) => response.data.id)
    .catch((failure) => {
      // ⚠️ A failed lookup must not be remembered as the answer — the next upload would inherit a
      // rejected promise for the rest of the session and fail for a reason that is long gone.
      folderIds.delete(key)
      throw failure
    })

  folderIds.set(key, asked)
  return asked
}

/** The caller's own cabinet directory — where anything uploaded with no folder in mind lands. */
export async function cabinetId(): Promise<string> {
  const profile = await authApi.getProfile().then((response) => response.data)

  if (!profile.filesRootId) {
    throw new Error("This account has no file cabinet.")
  }

  return profile.filesRootId
}

/** Whatever the Sharing Center says these files are reachable at. */
async function withLinks(files: ManagedFile[]): Promise<FileWithLink[]> {
  if (files.length === 0) {
    return []
  }

  const tokens = await shareApi
    .tokens("FILE", files.map((file) => file.id))
    .then((response) => response.data)

  return files.map((file) => {
    const viewToken = tokens[file.id] ?? null

    return {
      ...file,
      viewToken,
      downloadUrl: viewToken ? `/_/file/${viewToken}` : null,
    }
  })
}

// ── The cabinet itself ───────────────────────────────────────────────────────

/**
 * This account's own root directory, from the profile.
 *
 * ⚠️ **The profile is the only place it is discoverable.** `GET /directories` answers per owner and a
 * root is filed under nothing, so it comes back empty however it is asked — see `directoriesApi`.
 */
export function useCabinetRoot() {
  return useQuery<string>({
    queryKey: ["files", "cabinet-root"],
    queryFn: cabinetId,
    // It is made once, on first use, and never moves.
    staleTime: Infinity,
  })
}

// ⚠️ THE CABINET HOOKS ARE GONE, and the manager they served went with them (INVT-0096).
//
// `useDirectoryTree`, `useFilesIn`, `useCreateDirectory`, `useRenameDirectory`, `useDeleteDirectory`,
// `useRenameFile`, `useRefileFile`, `useDeleteFile` and `useImportFile` were the file screen's, and the
// file screen is `@jmouse/files` now. What replaced them is `lib/fileLibraryPort.ts`: the same calls,
// as a port the shared component holds, without react-query wrapped round each one.
//
// ⚠️ react-query did NOT move into the package, deliberately — making it a peer dependency there would
// pin three interfaces to one version of it for the sake of one screen. What is left here is what the
// rest of the product still asks for: the cabinet root, an upload from inside a form, and "my files".
