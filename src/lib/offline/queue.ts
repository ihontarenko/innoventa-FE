/**
 * Edits made while the network was not there, kept until it is.
 *
 * <p>A workshop has bad wifi. Somebody adjusts a count, walks behind a shelf, and the request fails.
 * In a browser tab that is a lost edit and a toast. In an installed station it has to be an edit that
 * lands when the signal comes back — which is the whole reason to install one.
 *
 * <h2>⚠️ Three decisions, taken deliberately, because each one can corrupt a real stock count</h2>
 *
 * <p><strong>1 · An adjustment is a DELTA, never a replacement.</strong> {@code subtract 3} composes
 * with a colleague's {@code subtract 2} and both land; {@code set to 41} silently throws their work
 * away. A queue of absolute values looks identical while it is being written and differs only on the
 * day two people were counting the same shelf. Whole-entry edits are still absolute — there is no
 * composing two people rewriting the same text — and they are the rarer act.
 *
 * <p><strong>2 · A refused replay is set aside, visibly, and the queue keeps draining.</strong> The
 * component was deleted, the permission was revoked, the count would go negative. It cannot be dropped
 * silently — that is somebody's work vanishing — and it cannot block everything behind it, or one bad
 * edit freezes the station. So it moves to a list the person can see and resolve.
 *
 * <p><strong>3 · A queued edit expires after seven days</strong> and joins that same list rather than
 * being applied. An adjustment replayed after a week is a fact about last week written as though it
 * were now, and nobody reading the stock level afterwards can tell.
 *
 * <h2>⚠️ Why IndexedDB and not localStorage</h2>
 *
 * <p>The queue has to survive the station being closed mid-walk and the device running out of memory.
 * Web storage is synchronous, small, and shared with every other station on this origin; a store of
 * its own is both durable and cheap to iterate in order.
 */

const DATABASE_NAME = "innoventa-station-offline"
const DATABASE_VERSION = 2
const QUEUE_STORE = "queue"
const SET_ASIDE_STORE = "set-aside"
const BLOB_STORE = "blobs"

/** Seven days. Long enough for a weekend and a forgotten phone; short enough to still mean something. */
export const QUEUED_EDIT_LIFETIME = 7 * 24 * 60 * 60 * 1000

export type QueuedEdit =
  | {
      kind: "adjust"
      id: string
      queuedAt: number
      spaceId: string
      formId: string
      entryId: string
      fieldName: string
      /** ⚠️ The change, not the result — see decision 1. */
      delta: number
      /** What the client believed it was changing from, for the person resolving a refusal. */
      believedValue: string | null
    }
  | {
      kind: "set"
      id: string
      queuedAt: number
      spaceId: string
      formId: string
      entryId: string
      fieldValues: Record<string, string>
    }
  | {
      /**
       * A photograph, which is bytes rather than a value — so it is two calls, and the second depends
       * on the first: upload, then write the reference into the entry's image field.
       */
      kind: "photograph"
      id: string
      queuedAt: number
      spaceId: string
      formId: string
      entryId: string
      fieldName: string
      /** What the file was called, for the set-aside list to say something recognisable. */
      fileName: string
      /** ⚠️ The bytes are NOT here — they are in the blob store, under this edit's id. */
      byteCount: number
    }

/**
 * A queued edit before it has an identity.
 *
 * ⚠️ **Distributed over the union deliberately, through a type parameter.** A plain
 * `Omit<QueuedEdit, "id" | "queuedAt">` collapses the union to the keys its members *share* — so
 * `fieldName` and `delta` vanish from the type, and the call site is refused for passing a property
 * that "does not exist". A conditional distributes only over a **naked type parameter**, which is what
 * the helper below is for; writing `QueuedEdit extends unknown ? …` inline does not distribute,
 * because `QueuedEdit` is a concrete alias rather than a parameter.
 */
type WithoutIdentity<T> = T extends unknown ? Omit<T, "id" | "queuedAt"> : never

export type NewQueuedEdit = WithoutIdentity<QueuedEdit>

export interface SetAsideEdit {
  id: string
  edit: QueuedEdit
  reason: string
  setAsideAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        database.createObjectStore(QUEUE_STORE, { keyPath: "id" })
      }
      if (!database.objectStoreNames.contains(SET_ASIDE_STORE)) {
        database.createObjectStore(SET_ASIDE_STORE, { keyPath: "id" })
      }
      // ⚠️ Bytes live in a store of their own, keyed by the edit that carries them. Putting a
      // photograph inside a queue record would turn every read of the queue — which happens on every
      // render — into a read of several megabytes.
      if (!database.objectStoreNames.contains(BLOB_STORE)) {
        database.createObjectStore(BLOB_STORE)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode)
        const request = run(transaction.objectStore(storeName))

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => database.close()
      }),
  )
}

/**
 * ⚠️ **The identifier is minted here rather than by the server**, so an edit queued offline already
 * has one — which is what lets the interface show it as pending, and what stops a replay that
 * half-succeeded from being sent twice under a different name.
 */
function mintIdentifier(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function queueEdit(edit: NewQueuedEdit): Promise<QueuedEdit> {
  const complete = { ...edit, id: mintIdentifier(), queuedAt: Date.now() } as QueuedEdit

  return transact(QUEUE_STORE, "readwrite", (store) => store.add(complete)).then(() => complete)
}

export function readQueue(): Promise<QueuedEdit[]> {
  return transact<QueuedEdit[]>(QUEUE_STORE, "readonly", (store) => store.getAll() as IDBRequest<QueuedEdit[]>)
    // ⚠️ Replayed in the order they were made. Two adjustments to one count are a sum either way, but
    // an adjustment after a whole-entry edit is not the same as before it.
    .then((edits) => edits.sort((first, second) => first.queuedAt - second.queuedAt))
}

export function readSetAside(): Promise<SetAsideEdit[]> {
  return transact<SetAsideEdit[]>(SET_ASIDE_STORE, "readonly", (store) => store.getAll() as IDBRequest<SetAsideEdit[]>)
}

/**
 * The largest photograph that may be queued.
 *
 * ⚠️ **A ceiling before anything is written, not after.** A phone camera makes several megabytes a
 * shot, and a queue that silently fills the device's storage quota is a station that stops working
 * with no message anybody can read. Refusing loudly at the moment of taking the picture is the only
 * point at which somebody can do something about it.
 */
export const LARGEST_QUEUED_PHOTOGRAPH = 8 * 1024 * 1024

export function keepBytes(identifier: string, blob: Blob): Promise<void> {
  return transact(BLOB_STORE, "readwrite", (store) => store.put(blob, identifier)).then(() => undefined)
}

export function readBytes(identifier: string): Promise<Blob | undefined> {
  return transact<Blob | undefined>(
    BLOB_STORE,
    "readonly",
    (store) => store.get(identifier) as IDBRequest<Blob | undefined>,
  )
}

export function forgetBytes(identifier: string): Promise<void> {
  return transact(BLOB_STORE, "readwrite", (store) => store.delete(identifier)).then(() => undefined)
}

/** ⚠️ Takes the bytes with it. An orphaned blob is quota nobody can find or free. */
export function forgetEdit(identifier: string): Promise<void> {
  return transact(QUEUE_STORE, "readwrite", (store) => store.delete(identifier))
    .then(() => forgetBytes(identifier))
    .then(() => undefined)
}

export function discardSetAside(identifier: string): Promise<void> {
  return transact(SET_ASIDE_STORE, "readwrite", (store) => store.delete(identifier)).then(() => undefined)
}

/** Out of the queue, into the list a person can see — decisions 2 and 3. */
export function setAside(edit: QueuedEdit, reason: string): Promise<void> {
  const record: SetAsideEdit = { id: edit.id, edit, reason, setAsideAt: Date.now() }

  return transact(SET_ASIDE_STORE, "readwrite", (store) => store.put(record))
    .then(() => forgetEdit(edit.id))
    .then(() => undefined)
}

export function hasExpired(edit: QueuedEdit, now = Date.now()): boolean {
  return now - edit.queuedAt > QUEUED_EDIT_LIFETIME
}

export interface DrainOutcome {
  sent: number
  setAside: number
  /** Left queued because the network is still not there — not a failure, just not yet. */
  waiting: number
}

/**
 * Send everything that can be sent, set aside everything that cannot, leave the rest.
 *
 * <p>⚠️ <strong>The three outcomes are told apart by the shape of the failure, and getting that
 * backwards is what makes a queue either lose work or freeze.</strong> A refusal from the server is an
 * answer — the edit will never be accepted, so it is set aside. A request that never got an answer is
 * not: the edit is untouched and tried again. Anything else is treated as the second, because leaving
 * an edit queued costs a retry and dropping one costs somebody's count.
 *
 * @param send performs one edit against the API, rejecting with an object carrying `status` where the
 *             server answered
 */
export async function drainQueue(
  send: (edit: QueuedEdit) => Promise<void>,
  now = Date.now(),
): Promise<DrainOutcome> {
  const outcome: DrainOutcome = { sent: 0, setAside: 0, waiting: 0 }

  for (const edit of await readQueue()) {
    if (hasExpired(edit, now)) {
      await setAside(edit, "This waited more than a week, so it was not applied — it would have written last week's count as though it were now.")
      outcome.setAside += 1
      continue
    }

    try {
      await send(edit)
      await forgetEdit(edit.id)
      outcome.sent += 1
    } catch (failure) {
      const status = (failure as { status?: number; response?: { status?: number } })?.status
        ?? (failure as { response?: { status?: number } })?.response?.status

      if (status === undefined) {
        // No answer came back. The network, not the server — keep it and try again later.
        outcome.waiting += 1
        continue
      }

      await setAside(edit, refusalWords(status))
      outcome.setAside += 1
    }
  }

  return outcome
}

function refusalWords(status: number): string {
  if (status === 404) {
    return "What this changed no longer exists."
  }
  if (status === 403 || status === 401) {
    return "You no longer have permission to make this change here."
  }
  if (status === 409 || status === 422 || status === 400) {
    return "The change was refused — it may have conflicted with somebody else's."
  }

  return `The change was refused (${status}).`
}
