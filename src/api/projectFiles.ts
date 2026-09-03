import { http } from "./http"

/**
 * Which directory a project's files live in.
 *
 * ⚠️ **This is the only thing the product answers about project files.** Uploading, listing and
 * deleting are `jmouse-storage-management`'s own routes, called with this directory as the owner — see
 * `api/files.ts`. A second upload path through the product would be a second place for the size limit,
 * the allowed types and the quota to be decided.
 */
export interface ProjectFolder {
  /** Null while the project has no folder — nobody has uploaded anything yet. */
  directoryId: string | null
  path: string | null
}

export const projectFilesApi = {
  /** ⚠️ A read that does NOT create the folder — opening a project must not make a directory. */
  folder: (projectId: string) => http.get<ProjectFolder>(`/projects/${projectId}/files`),

  /** ⚠️ Creates it if it has none. Called when somebody is actually about to upload. */
  requireFolder: (projectId: string) =>
    http.post<ProjectFolder>(`/projects/${projectId}/files/folder`),
}
