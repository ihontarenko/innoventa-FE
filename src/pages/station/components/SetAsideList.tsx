import { Alert, AlertDescription, Button } from "@jmouse/ui"
import type { useOfflineQueue } from "@/lib/offline/useOfflineQueue"

/**
 * Edits that will never be sent, and what to do about them.
 *
 * <h2>⚠️ A surface, not an error path</h2>
 *
 * <p>This is half of the second decision in ADR 23, and the half that is easy to skip. A replay can be
 * refused — the component was deleted, the permission was revoked, the change conflicted — and a queue
 * has exactly two wrong answers available to it: drop the edit silently, which is somebody's work
 * vanishing, or block on it, which lets one bad edit freeze everything behind it forever.
 *
 * <p>So a refusal is set aside and <em>shown</em>. Every reason it happens is something a person
 * resolves, and none of them is something a retry loop can.
 *
 * <p>⚠️ <strong>Discarding is the only action offered, and it is deliberate.</strong> Re-applying from
 * here would mean guessing what the person meant against a component that has since changed — the
 * honest move is to look at the component now and decide again.
 */
export function SetAsideList({ queue }: { queue: ReturnType<typeof useOfflineQueue> }) {
  if (queue.setAside.length === 0) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertDescription>
        <p className="mb-2 text-[12.5px] font-medium">
          {queue.setAside.length === 1
            ? "One change could not be applied"
            : `${queue.setAside.length} changes could not be applied`}
        </p>

        <ul className="flex flex-col gap-2">
          {queue.setAside.map((record) => (
            <li key={record.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] leading-relaxed">{record.reason}</p>
                {record.edit.kind === "adjust" && (
                  <p className="text-[11px] opacity-80">
                    {record.edit.delta > 0 ? `+${record.edit.delta}` : record.edit.delta} on{" "}
                    {record.edit.fieldName}
                    {record.edit.believedValue !== null && ` — it was ${record.edit.believedValue} here`}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="xs" onClick={() => void queue.discard(record.id)}>
                Discard
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
