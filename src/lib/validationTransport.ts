import { transportOver, type HttpMethod, type ValidationTransport } from "@jmouse/validation"
import { createApiClient } from "@/api/http"
import { LIBRARY_ROUTES } from "@/api/libraryRoutes"

const http = createApiClient(LIBRARY_ROUTES.validation)

/** ⚠️ Innoventa own API — who points at a document is this product question, never the library one. */
const innoventa = createApiClient("/api")

/**
 * How the shared `.jmv` builder reaches Innoventa's backend.
 *
 * ## ⚠️ Innoventa's OWN client, never a second one
 *
 * `createApiClient` carries the workspace header, the queued token refresh and the error events every
 * other screen depends on. A shared package bringing its own client would mean a request that skips all
 * of it — and the failure is a silent sign-out on one panel while every other screen quietly
 * re-authenticates.
 *
 * ## ⚠️ The base is the LIBRARY's, so the prefix is empty
 *
 * Every library surface answers under `/jmouse/<namespace>/api` — see `api/libraryRoutes.ts` for why
 * that address lives in exactly one file here.
 *
 * ## ⚠️ The refusal has to survive the client
 *
 * A document the form cannot show comes back as **422 with a `construct` property** on an RFC 7807
 * body; text that will not parse comes back as **400 with `line` and `column`**. The package reads the
 * first off whatever was thrown — the error itself, `error.body`, `error.response.data`. What must not
 * happen is this file swallowing the body and re-throwing a bare `Error`, which turns *the form cannot
 * show this construct* into *something went wrong*.
 */
const request = async <T>(method: HttpMethod, url: string, body?: unknown): Promise<T> => {
  // ⚠️ All four verbs, because the documents screen writes and deletes as well as reads. A GET/POST-only
  // dispatcher silently POSTed a delete, which the backend answered 405 for — a failure that reads as a
  // missing route rather than as a client that cannot say what it meant.
  const response =
    method === "GET"
      ? await http.get(url)
      : method === "PUT"
        ? await http.put(url, body)
        : method === "DELETE"
          ? await http.delete(url)
          : await http.post(url, body)

  return response.data as T
}

export const validationTransport: ValidationTransport = transportOver(request, "")

/** One stored document, as the library's document controller answers. */
export interface StoredValidationDocument {
  /** ⚠️ What a form POINTS at — the pointer has to survive the document being renamed. */
  id: string
  name: string
  source: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Reads one stored document by its id.
 *
 * ⚠️ **By id, because that is what a form points at.** `form_configs`' `validation.document` holds the
 * id rather than the name, so that renaming a document cannot silently detach every form using it.
 */
export async function readValidationDocument(id: string): Promise<StoredValidationDocument> {
  const response = await http.get(`/documents/by-id?id=${encodeURIComponent(id)}`)

  return response.data as StoredValidationDocument
}

/**
 * Writes a document under a name, creating it or replacing what it says.
 *
 * ⚠️ The server parses before it stores, through the same reader the runtime loads with — so what is
 * accepted here is what will load, rather than a file that fails at the next boot.
 */
export async function writeValidationDocument(
  name: string,
  source: string,
): Promise<StoredValidationDocument> {
  const response = await http.put(`/documents/one?name=${encodeURIComponent(name)}`, { source })

  return response.data as StoredValidationDocument
}

/**
 * Replaces what an existing document says, by its id.
 *
 * ⚠️ Renaming is deliberately not possible here. A document is addressed by name in every file that
 * loads one, so a rename is somebody pointing an address at different rules — a decision rather than an
 * edit, and doing it on a save would make it invisible.
 */
export async function rewriteValidationDocument(
  id: string,
  source: string,
): Promise<StoredValidationDocument> {
  const response = await http.put(`/documents/by-id?id=${encodeURIComponent(id)}`, { source })

  return response.data as StoredValidationDocument
}


/** A form judged by a document, as Innoventa's usage route answers. */
export interface BoundForm {
  id: string
  name: string
}

/**
 * Which forms a document judges.
 *
 * ⚠️ **Innoventa's question, not the library's.** `validation_documents` has no foreign key into
 * `form_configs` — deliberately — so nothing in the database can answer it and nothing refuses a delete
 * that strands a form. The documents screen refuses it on the strength of this.
 */
export async function readBoundForms(documentId: string): Promise<BoundForm[]> {
  const response = await innoventa.get(`/validation/documents/${documentId}/forms`)

  return response.data as BoundForm[]
}

/**
 * Stops a form being judged by a document.
 *
 * ⚠️ Deletes the **pointer**, never the document — several forms share one row, and taking one form off
 * it must not disturb the others.
 */
export async function detachFormFromDocument(documentId: string, formId: string): Promise<void> {
  await innoventa.delete(`/validation/documents/${documentId}/forms?formId=${encodeURIComponent(formId)}`)
}
