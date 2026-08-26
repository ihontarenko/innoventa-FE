import { createApiClient, http as platformHttp } from "./http"
import { LIBRARY_ROUTES } from "./libraryRoutes"

/**
 * ⚠️ **The LIBRARY's base path, not Innoventa's `/api`** (`UIK-8`). Files and the directory tree are
 * served by `jmouse-storage-management` at `jmouse.files.management.prefix` — an address nobody would
 * invent by accident, so a route beneath it is visibly not this product's.
 *
 * ⚠️ It is written in THREE files and nothing checks that they agree: the backend property, the Vite
 * proxy entry, and this line. When they drift every call 404s and the manager reads as an account with
 * no files. Change one, change three.
 */
const http = createApiClient(LIBRARY_ROUTES.files)

/**
 * A file, as the shared file library describes one.
 *
 * ⚠️ **No `viewToken` and no `isPrivate` here.** Since `INVT-0063` the file routes are
 * `jmouse-storage-management`'s, and a share token is not something it knows about — it is a Sharing
 * Center row that happens to point at a file. Ask `shareApi.tokens` for the links, in one call for the
 * whole list rather than one per row.
 */
export interface ManagedFile {
  id: string
  name: string
  contentType: string
  sizeBytes: number
  uploadedBy: string | null
  createdAt: string
}

/** A file, with whatever the Sharing Center says it is reachable at. */
export interface FileWithLink extends ManagedFile {
  viewToken: string | null
  downloadUrl: string | null
}

/**
 * Every file URL the interface renders, built in one place.
 *
 * ⚠️ **Never assemble `/_/file/…` by hand.** The route is served by the backend rather than the SPA
 * (see the dev proxy), and when it moves this module is the only thing that has to.
 */
export const fileLinks = {
  /** Public, token-addressed — works without a session and may redirect to the storage provider. */
  view: (viewToken: string) => `/_/file/${viewToken}`,
  absoluteView: (viewToken: string) => `${window.location.origin}/_/file/${viewToken}`,
  viewer: (viewToken: string) => `/_/viewer/${viewToken}`,
  /** ⚠️ The address somebody is GIVEN — the branded page, absolute so it survives being pasted. */
  absoluteViewer: (viewToken: string) => `${window.location.origin}/_/viewer/${viewToken}`,
}

/**
 * The shape of a stored file field value: `"{viewToken}:{filename}"`.
 *
 * ⚠️ **Matched by SHAPE, never by length.** The token is a 16-character opaque id today, a 36-character
 * UUID in older rows, and any length at all once an administrator configures a link pattern — deciding
 * by length is exactly what once blanked every image preview in the product. Prose that happens to
 * contain a colon (`"Note: see the datasheet"`) does not match, which is what makes this safe to run
 * over a value whose field type is unknown.
 *
 * ⚠️ **An extension may hold an underscore.** `.kicad_sym` and `.kicad_mod` are the two most common files
 * in the CAD catalogue, and a class of letters and digits alone rejects both — the value then fails to
 * parse, and every screen falls back to printing the raw `token:filename` at whoever opened it. A parse
 * that fails is not visible as a failure anywhere; it renders as an identifier where a name should be.
 */
const FILE_FIELD_VALUE = /^([A-Za-z0-9._~-]{4,}):([^\s\\/:*?"<>|][^\\/:*?"<>|]*\.[A-Za-z0-9_]{1,12})$/

export interface FileFieldValue {
  viewToken: string
  filename: string
}

export function parseFileFieldValue(value: string | null | undefined): FileFieldValue | null {
  if (!value || value.startsWith("http")) {
    return null
  }

  const match = FILE_FIELD_VALUE.exec(value)

  return match ? { viewToken: match[1], filename: match[2] } : null
}

export function composeFileFieldValue(viewToken: string, filename: string): string {
  return `${viewToken}:${filename}`
}

/**
 * What a file is filed against.
 *
 * ⚠️ **`DIRECTORY:<id>`, always.** Innoventa files into the library's directory tree — every account has
 * a tree of its own — and the owner is one string because an access rule can name exactly one request
 * parameter as the thing a route acts on.
 */
export const fileOwner = {
  directory: (directoryId: string) => `DIRECTORY:${directoryId}`,
}

export const filesApi = {
  /** Everything filed directly in one directory. */
  list: (owner: string) => http.get<ManagedFile[]>("/files", { params: { owner } }),

  read: (fileId: string) => http.get<ManagedFile>(`/files/${fileId}`),

  /**
   * Which folder a given kind of file belongs in — `files`, `inventory`, `cad`.
   *
   * ⚠️ **A folder INSIDE the cabinet, not a root beside it.** The file manager opens at the cabinet and
   * reads down from it, so a sibling root is a folder nobody can see — and filing into an invisible
   * place is worse than the untidy cabinet it was meant to fix.
   *
   * ⚠️ **`platformHttp`, not the `http` above.** Everything else in this module is the storage library's
   * and lives under its own prefix; *which root a feature files into* is this product's decision and
   * therefore this product's route. Sent through the library client it would 404, and a 404 here reads
   * as "this account has no such folder" rather than as an address nobody serves.
   *
   * ⚠️ **The server creates it on first ask**, so this is a write the first time and a read forever
   * after. It is asked when something is about to be filed, never on sign-in: provisioning every root
   * for every account would make folders for people who will never upload a footprint.
   */
  folder: (name: string) =>
    platformHttp.get<{ id: string; path: string }>(`/file-folders/${name}`),

  /**
   * The bytes themselves, for anything that has to draw them.
   *
   * ⚠️ **This route is AUTHENTICATED, unlike `/_/file/{token}`** — so an `<img src>` or an
   * `<iframe src>` pointed at it carries no credentials and answers 401, which renders as *the file is
   * missing*. Whatever shows these bytes has to fetch them through this client and hold an object URL.
   *
   * ⚠️ **Which is why the viewer needs it even though this product has share tokens.** A token exists
   * only for a file somebody has published through the Sharing Center; the cabinet is full of files
   * that have none, and those are exactly the ones a preview would silently fail on.
   */
  content: (fileId: string) => http.get<Blob>(`/files/${fileId}/content`, { responseType: "blob" }),

  upload: (owner: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData()
    formData.append("file", file)

    return http.post<ManagedFile>("/files", formData, {
      params: { owner },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total))
        }
      },
    })
  },

  /** Fetch a web address and keep what comes back. */
  importFrom: (owner: string, url: string) =>
    http.post<ManagedFile>("/files/import", { url }, { params: { owner } }),

  rename: (fileId: string, name: string) => http.put<ManagedFile>(`/files/${fileId}`, { name }),

  /** Move it into another directory. */
  refile: (fileId: string, directoryId: string) =>
    http.put<ManagedFile>(`/files/${fileId}/binding`, {
      ownerType: "DIRECTORY",
      ownerId: directoryId,
    }),

  setPrivate: (fileId: string, isPrivate: boolean) =>
    http.patch<ManagedFile>(`/files/${fileId}/private`, { isPrivate }),

  delete: (fileId: string) => http.delete(`/files/${fileId}`),
}

/**
 * The directory tree — everybody's file cabinet, and the folders in it.
 *
 * ⚠️ **`parentId` is OPTIONAL, not nullable, and the difference has teeth.** Innoventa serialises
 * non-null only, so a root directory arrives with the key **absent** rather than set to `null` — and
 * `directory.parentId === null` is then silently false for every root there is. Ask `root` instead, or
 * test for falsiness; never for `null`.
 */
export interface Directory {
  id: string
  name: string
  /** The full path, slash-separated — `innoventa/files/datasheets`. */
  path: string
  parentId?: string
  /** Whether this is a cabinet's own top. The reliable way to find one. */
  root: boolean
  /** How deep it sits, with the root at 1 — enough to indent a flat list without rebuilding the tree. */
  depth: number
}

/**
 * ⚠️ **There is no "list the roots" call, and asking for one is the trap.** `GET /directories` answers
 * for an owner and a cabinet's root is not filed under anything, so it comes back empty however it is
 * asked. The way in is the profile: `filesRootId` names this account's own root, and `subtree` reads
 * down from it in one request.
 */
export const directoriesApi = {
  subtree: (directoryId: string) => http.get<Directory[]>(`/directories/${directoryId}/subtree`),

  create: (parentId: string, name: string) =>
    http.post<Directory>("/directories", { name }, { params: { parentId } }),

  rename: (directoryId: string, name: string) =>
    http.put<Directory>(`/directories/${directoryId}`, { name }),

  move: (directoryId: string, parentId: string) =>
    http.put<Directory>(`/directories/${directoryId}/parent`, { parentId }),

  /**
   * ⚠️ **`withSubtree` is the difference between a refusal and losing a branch.** Without it the
   * backend refuses to delete a folder that still holds anything, which is the safe default and the one
   * the screen offers first.
   */
  delete: (directoryId: string, withSubtree = false) =>
    http.delete(`/directories/${directoryId}`, { params: { withSubtree } }),
}

/**
 * Public links, which belong to the Sharing Center rather than to any one kind of thing.
 *
 * ⚠️ **`platformHttp`, NOT the library client this file otherwise uses, and that is the whole bug this
 * comment exists to prevent.** These three routes are `ShareTokenController`'s, under Innoventa's own
 * `/api` — a share is a Sharing Center row that happens to point at a file, and the file library has no
 * notion of one. Written with the client at the top of this module they resolve to
 * `/jmouse/files/api/share/tokens`, which nothing serves: every file field then renders *No endpoint
 * exists at …* in place of its picker.
 *
 * ⚠️ **Ask for a whole page's tokens at once.** One request per row is a request per file on the screen
 * that has the most of them.
 */
export const shareApi = {
  tokens: (entityType: string, ids: string[]) =>
    platformHttp.get<Record<string, string>>("/share/tokens", { params: { entityType, ids } }),

  rotate: (entityType: string, entityId: string) =>
    platformHttp.post<{ token: string }>(`/share/${entityType}/${entityId}/rotate`),

  revoke: (entityType: string, entityId: string) => platformHttp.delete(`/share/${entityType}/${entityId}`),
}

// ⚠️ The installation's public settings used to be a second `configApi` here, over the same `/config`
// route the registration screen reads — two names, two cache keys, one endpoint, and a page size that
// could differ between two screens depending on which had asked. It lives in `api/settings.ts` as
// `publicConfigurationApi` now, and `usePublicConfiguration` is the only hook over it.
