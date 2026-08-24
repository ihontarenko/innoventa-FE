import { useEffect, useRef, useState } from "react"
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from "@jmouse/ui"
import { custodyApi, type ScanResolution } from "@/api/custody"

/**
 * Point the camera at a sticker, or type what is printed on it.
 *
 * ⚠️ **Both go through the same endpoint and the same ladder.** A separate route for "I typed it" would
 * be a second ladder, and the two would drift on the day somebody added a rung. The camera is a way of
 * producing a string; everything after that is identical.
 *
 * ⚠️ **The camera is an enhancement, never a requirement.** `BarcodeDetector` is not in every browser
 * and a camera is not on every machine, so the typed field is always present and is what the dialog
 * opens focused on. A scanner screen that is useless without a camera is useless at a desk.
 *
 * ⚠️ **Nothing is queued, retried or stored.** A failed request is a failed request — the offline queue
 * is deliberately outside this cluster, because it starts with conflicts and ordering rather than with
 * a resolver.
 */
export function ScanDialog({
  onResolved,
  onClose,
}: {
  onResolved: (resolution: ScanResolution) => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<ScanResolution | null>(null)
  const [cameraProblem, setCameraProblem] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    // ⚠️ Feature-detected rather than assumed, and failing is not an error state: no camera means the
    // typed field, which was always going to be there.
    const detectorAvailable = "BarcodeDetector" in window

    if (!detectorAvailable) {
      setCameraProblem("This browser cannot read codes from a camera — type what is printed instead.")
      return
    }

    let stream: MediaStream | null = null
    let stopped = false

    async function watch() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "code_39"],
        })

        while (!stopped && videoRef.current) {
          const found = await detector.detect(videoRef.current)

          if (found.length > 0) {
            void look(found[0].rawValue)
            return
          }

          await new Promise((wake) => setTimeout(wake, 250))
        }
      } catch {
        setCameraProblem("The camera could not be opened — type what is printed instead.")
      }
    }

    void watch()

    return () => {
      stopped = true
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function look(code: string) {
    setBusy(true)

    try {
      const resolution = await custodyApi.scan(code).then((response) => response.data)

      if (resolution.kind === "asset" || resolution.kind === "location") {
        onResolved(resolution)
        return
      }

      setAnswer(resolution)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find a thing</DialogTitle>
          <DialogDescription>
            Point the camera at the sticker, or type the number printed on it.
          </DialogDescription>
        </DialogHeader>

        {cameraProblem ? (
          <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
            {cameraProblem}
          </p>
        ) : (
          <video ref={videoRef} className="aspect-video w-full rounded-md bg-muted" muted playsInline />
        )}

        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Inventory number, or a scanned code"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && typed.trim() && void look(typed.trim())}
          />
          <Button type="button" disabled={busy || !typed.trim()} onClick={() => void look(typed.trim())}>
            Find it
          </Button>
        </div>

        {answer?.kind === "none" && (
          <p className="rounded-md border border-dashed px-3 py-3 text-xs">
            Nothing here carries that. Register it as a new thing?
          </p>
        )}

        {/* ⚠️ Several matches are handed back rather than one being chosen. An inventory number is a
            field value — editable and duplicable — so a match is a search that sometimes finds two, and
            picking silently would be right about half the time with no way to notice the other half. */}
        {answer?.kind === "candidates" && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              {answer.candidates.length} things carry that number. Which one?
            </p>
            {answer.candidates.map((candidate) => (
              <Button
                key={candidate.subjectId}
                type="button"
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() =>
                  onResolved({ kind: "asset", subjectId: candidate.subjectId, label: candidate.label, candidates: [] })
                }
              >
                {candidate.label}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
