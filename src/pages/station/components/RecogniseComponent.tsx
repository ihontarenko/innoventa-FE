import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { Button, Skeleton } from "@jmouse/ui"
import { assistantApi } from "@/api/assistant"
import { fileOwner, filesApi } from "@/api/files"
import { cabinetId } from "@/hooks/useFiles"
import { useAuthStore } from "@/stores/authStore"
import { platformItem } from "@/navigation"

/**
 * Photograph a component or a board, and let the assistant say what it is.
 *
 * <h2>⚠️ It is the Assistant, not a second thing that looks like it</h2>
 *
 * <p>The same three steps every attachment in this product takes: the picture goes into the account's
 * own file cabinet through the ordinary route, only its **identifier** travels with the question, and
 * the answer comes back from `/assistant/ask`. There is no separate vision endpoint and there must not
 * be one — a second path would be a second, invisible store of somebody's photographs, and a second set
 * of limits to keep in step with the backend's.
 *
 * <h2>⚠️ Absent rather than broken</h2>
 *
 * <p>Drawn only where this installation actually has a model configured *and* the account holds
 * `assistant:use`. An installation with no provider is a supported arrangement, so a control that
 * answered every photograph with the same configuration error would be worse than no control — the
 * Assistant screen already decided this and this follows it rather than deciding again.
 *
 * <h2>⚠️ It suggests, and a person accepts</h2>
 *
 * <p>The answer is never written anywhere by itself. It fills a field somebody then reads, edits and
 * saves — because a model that is confidently wrong about a resistor's value would otherwise put that
 * value into real stock with nobody having looked at it.
 */
export function RecogniseComponent({ onRecognised }: { onRecognised: (name: string) => void }) {
  const mayUse = useAuthStore((state) => state.holds)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const availability = useQuery({
    queryKey: ["assistant", "availability"],
    queryFn: () => assistantApi.availability().then((response) => response.data),
    enabled: mayUse(platformItem("assistant")),
    staleTime: 5 * 60_000,
  })

  if (!mayUse(platformItem("assistant")) || (availability.data && !availability.data.available)) {
    return null
  }

  const look = async (file: File) => {
    setBusy(true)
    setProblem(null)
    setSuggestion(null)

    try {
      const uploaded = await filesApi.upload(fileOwner.directory(await cabinetId()), file)

      const answer = await assistantApi
        .ask({
          // ⚠️ Asked for ONE line. The assistant is a conversation everywhere else in this product; here
          // its answer goes into a text field, and a paragraph of hedging pasted into a component's name
          // is worse than no suggestion at all.
          question:
            "Look at this photograph of an electronic component or board. Answer with one short line "
            + "naming what it is — the part number if it is readable, otherwise the type and its main "
            + "value. No explanation, no preamble.",
          messages: [],
          attachments: [uploaded.data.id],
        })
        .then((response) => response.data)

      const line = answer.answer.trim().split("\n")[0]?.trim() ?? ""

      if (!line) {
        setProblem("The assistant could not make anything of that photograph.")

        return
      }

      setSuggestion(line)
    } catch {
      setProblem("The assistant could not be asked just now.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="border-border active:bg-accent flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-[13px]">
        <Sparkles className="size-4" />
        {busy ? "Looking…" : "Photograph it and let the assistant name it"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]

            event.target.value = ""

            if (file) {
              void look(file)
            }
          }}
        />
      </label>

      {busy && <Skeleton className="h-11" />}

      {problem && <p className="text-muted-foreground text-[12px] leading-relaxed">{problem}</p>}

      {suggestion && (
        <div className="border-border flex items-center gap-2 rounded-lg border p-2">
          <p className="min-w-0 flex-1 text-[13px]">{suggestion}</p>
          {/* ⚠️ Accepted by hand. A model that is confidently wrong about a value would otherwise put
              that value into real stock with nobody having read it. */}
          <Button
            className="h-10 shrink-0"
            onClick={() => {
              onRecognised(suggestion)
              setSuggestion(null)
            }}
          >
            Use it
          </Button>
        </div>
      )}
    </div>
  )
}
