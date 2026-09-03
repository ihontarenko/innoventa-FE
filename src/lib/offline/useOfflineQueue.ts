import { useCallback, useEffect, useState } from "react"
import { entriesApi } from "@/api/forms"
import { fileOwner, filesApi } from "@/api/files"
import { stockApi } from "@/api/stock"
import type { MovementReason } from "@/api/stock"
import { cabinetId } from "@/hooks/useFiles"
import type { NewQueuedEdit, QueuedEdit, SetAsideEdit } from "./queue"
import { discardSetAside, drainQueue, keepBytes, queueEdit, readBytes, readQueue, readSetAside } from "./queue"

/**
 * The offline queue, as React state — pending edits, the ones set aside, and the draining.
 *
 * ⚠️ **It drains on reconnect and on mount, in the foreground.** Background Sync exists on Chromium
 * and not on Safari, so it is a bonus rather than the mechanism: a station that relied on it would
 * work for half the phones this is built for and silently not for the other half.
 */
export interface OfflineQueue {
  /** Edits waiting to be sent, oldest first. */
  pending: QueuedEdit[]
  /** Edits that will never be sent, with the reason — a list a person resolves. */
  setAside: SetAsideEdit[]
  online: boolean
  draining: boolean
  /** Queue an edit, or send it now where there is a network. Either way it is recorded first. */
  enqueue: (edit: NewQueuedEdit) => Promise<void>
  /** Queue a photograph — the bytes are kept beside the edit, never inside it. */
  enqueuePhotograph: (edit: Extract<NewQueuedEdit, { kind: "photograph" }>, bytes: Blob) => Promise<void>
  drain: () => Promise<void>
  discard: (identifier: string) => Promise<void>
  /** How much this station has adjusted a field by but not yet had confirmed. */
  pendingDeltaFor: (entryId: string, fieldName: string) => number
}

/**
 * ⚠️ **One edit, sent the way its kind means.** An adjustment is a delta and has to be applied to
 * whatever the server holds *now*, so it goes to the stock route as a movement with a reason — the
 * server adds it to the current figure, which is what keeps two people counting one shelf from erasing
 * each other. A whole-entry edit is absolute and goes straight out.
 *
 * ⚠️ **It used to read the entry and write back the sum**, and that stopped working the day a quantity
 * became something only a movement changes: every touch of ±1 came back 409. Sending the delta is not
 * the workaround for that guard — it is what the guard exists to insist on, and it is better than what
 * it replaced, because the sum was computed from a figure that could already be stale.
 */
async function sendEdit(edit: QueuedEdit): Promise<void> {
  if (edit.kind === "set") {
    await entriesApi.update(edit.formId, edit.entryId, edit.fieldValues)

    return
  }

  if (edit.kind === "photograph") {
    const bytes = await readBytes(edit.id)

    if (!bytes) {
      // The blob is gone — a cleared site, a quota eviction. Nothing to send and nothing to retry.
      throw { status: 410 }
    }

    const uploaded = await filesApi.upload(
      fileOwner.directory(await cabinetId()),
      new File([bytes], edit.fileName, { type: bytes.type || "image/jpeg" }),
    )

    // ⚠️ **Two calls, and the second can fail with the first already done.** The bytes are then on the
    // server with nothing pointing at them. They are NOT deleted again: somebody walked to a shelf to
    // take that photograph, and it is in their own cabinet where they can attach it by hand — which is
    // what the set-aside entry tells them to do.
    const current = await entriesApi.get(edit.formId, edit.entryId)
    const values = { ...(current.data.fieldValues ?? {}) }

    values[edit.fieldName] = uploaded.data.id

    await entriesApi.update(edit.formId, edit.entryId, values)

    return
  }

  await stockApi.adjust(edit.entryId, {
    delta: edit.delta,
    reason: reasonFor(edit.delta),
    surface: "STATION",
  })
}

/**
 * What a press at the shelf means, read from its sign.
 *
 * ⚠️ **Not `COUNT`, and not a question asked on the screen.** One less at a shelf is a part taken to be
 * used and one more is a part coming back — those are `ISSUE` and `RECEIPT` in the journal's own words,
 * and both are reasons whose sign can only ever match. Calling every press a stocktake would file
 * ordinary work as counting and leave a real stocktake indistinguishable from it; asking which it was
 * would put a tap in front of the one interaction the station exists to make instant.
 *
 * ⚠️ **A press with no project behind it still has no project.** `ISSUE` normally carries one and here
 * carries none — that is the honest record of a part taken at a bench, not a field left unfilled.
 */
function reasonFor(delta: number): MovementReason {
  return delta < 0 ? "ISSUE" : "RECEIPT"
}

export function useOfflineQueue(): OfflineQueue {
  const [pending, setPending] = useState<QueuedEdit[]>([])
  const [setAsideEdits, setSetAsideEdits] = useState<SetAsideEdit[]>([])
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  const [draining, setDraining] = useState(false)

  const refresh = useCallback(async () => {
    setPending(await readQueue())
    setSetAsideEdits(await readSetAside())
  }, [])

  const drain = useCallback(async () => {
    setDraining(true)
    try {
      await drainQueue(sendEdit)
    } finally {
      setDraining(false)
      await refresh()
    }
  }, [refresh])

  useEffect(() => {
    void refresh()

    const cameBack = () => {
      setOnline(true)
      void drain()
    }
    const wentAway = () => setOnline(false)

    window.addEventListener("online", cameBack)
    window.addEventListener("offline", wentAway)

    // ⚠️ Drained on mount too, not only on the `online` event: a station launched from a home screen
    // after the signal came back never sees that event fire.
    if (navigator.onLine) {
      void drain()
    }

    return () => {
      window.removeEventListener("online", cameBack)
      window.removeEventListener("offline", wentAway)
    }
  }, [drain, refresh])

  const enqueue = useCallback(
    async (edit: NewQueuedEdit) => {
      // ⚠️ Recorded BEFORE it is attempted, always. An edit sent and lost between the request leaving
      // and the answer arriving is exactly the case a queue exists for, and one that was never written
      // down cannot be replayed.
      await queueEdit(edit)
      await refresh()

      if (navigator.onLine) {
        await drain()
      }
    },
    [drain, refresh],
  )

  const enqueuePhotograph = useCallback(
    async (edit: Extract<NewQueuedEdit, { kind: "photograph" }>, bytes: Blob) => {
      // ⚠️ Bytes first. An edit recorded with no blob behind it is one that can only ever be set aside.
      const queued = await queueEdit(edit)

      await keepBytes(queued.id, bytes)
      await refresh()

      if (navigator.onLine) {
        await drain()
      }
    },
    [drain, refresh],
  )

  const discard = useCallback(
    async (identifier: string) => {
      await discardSetAside(identifier)
      await refresh()
    },
    [refresh],
  )

  const pendingDeltaFor = useCallback(
    (entryId: string, fieldName: string) =>
      pending.reduce(
        (total, edit) =>
          edit.kind === "adjust" && edit.entryId === entryId && edit.fieldName === fieldName
            ? total + edit.delta
            : total,
        0,
      ),
    [pending],
  )

  return { pending, setAside: setAsideEdits, online, draining, enqueue, enqueuePhotograph, drain, discard, pendingDeltaFor }
}
