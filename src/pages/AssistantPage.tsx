import { useEffect, useMemo, useRef, useState } from "react"
import { Paperclip, X } from "lucide-react"
import { Button, Skeleton, Textarea } from "@jmouse/ui"
import type { AttachmentLimits } from "@/api/assistant"
import { fileOwner, filesApi } from "@/api/files"
import { AccessDenied } from "@/components/AccessDenied"
import { PageHeader } from "@/components/PageHeader"
import { AssistantTranscript } from "@/components/assistant/AssistantTranscript"
import type { TurnRecord } from "@/components/assistant/AssistantTranscript"
import { useAskAssistant, useAssistantAvailability } from "@/hooks/useAssistant"
import { buildTranscript, pendingConfirmation } from "@/lib/assistantTranscript"
import type { AssistantMessage } from "@/lib/assistantTranscript"
import { problemDetailOf } from "@/lib/apiErrors"
import { platformItem } from "@/navigation"
import { useAuthStore } from "@/stores/authStore"

/**
 * Somebody asking Innoventa about their own records, in words.
 *
 * ⚠️ **This screen is the point of the whole tool mechanism, and the size of it is the evidence.** It
 * holds a text box, a transcript and a Confirm button. Every namespace, every permission check, every
 * guard, the workspace confinement, the audit trail and the call counters are behind
 * `POST /api/assistant/ask` and none of them are mentioned here — because the assistant holds the same
 * dispatcher that every connected client holds, in process, as the person asking.
 *
 * ⚠️ **The conversation lives in this component and nowhere else.** A reload starts a new one. That is a
 * decision with a retention question behind it: a stored conversation contains whatever the tools
 * returned, which is somebody's own records copied into a second place with a second lifetime.
 * Persisting it is a separate ticket, and pretending otherwise by writing it to local storage would
 * answer that question by accident.
 */
/**
 * ⚠️ **The sidebar entry itself, not a repetition of what it says.** `assistant:use` is a GLOBAL
 * permission, so this asks the installation-wide question — but *which* question is written on the
 * entry rather than chosen again here. It was chosen again here once, differently, and the result was
 * this screen working perfectly for an account whose menu had no way to reach it.
 */
const ASSISTANT = platformItem("assistant")

export default function AssistantPage() {
  const allowed = useAuthStore((state) => state.holds(ASSISTANT))

  if (!allowed) {
    return (
      <AccessDenied
        title={ASSISTANT.label}
        why="Holding a conversation costs the installation tokens, so it is granted separately from what you may do with your own records."
        permissions={ASSISTANT.requiredPermission ? [ASSISTANT.requiredPermission] : []}
      />
    )
  }

  return (
    <>
      <PageHeader title="Assistant" description="Ask about your workspaces, and have it do the looking" />
      <Conversation />
    </>
  )
}

function Conversation() {
  const availability = useAssistantAvailability()
  const ask = useAskAssistant()
  const pictures = usePendingPictures(availability.data?.attachments)

  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [turns, setTurns] = useState<TurnRecord[]>([])
  const [draft, setDraft] = useState("")
  const [asked, setAsked] = useState<AskedTurn | null>(null)

  const entries = useMemo(() => buildTranscript(messages), [messages])
  const pending = useMemo(() => pendingConfirmation(entries), [entries])
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries.length, asked])

  function send(question: string) {
    const trimmed = question.trim()

    if (trimmed.length === 0 || ask.isPending || pictures.isUploading) {
      return
    }

    const attached = pictures.attached

    setAsked({ text: trimmed, previews: attached.map((picture) => picture.preview) })
    setDraft("")

    ask.mutate(
      { question: trimmed, messages, attachments: attached.map((picture) => picture.fileId) },
      {
        onSuccess: (answer) => {
          setMessages(answer.messages)
          setTurns((existing) => [
            ...existing,
            {
              lastMessageIndex: answer.messages.length - 1,
              toolCalls: answer.toolCalls,
              inputTokens: answer.inputTokens,
              outputTokens: answer.outputTokens,
              finished: answer.finished,
            },
          ])
          setAsked(null)
          // ⚠️ Released only once the answer is in. The turn that came back carries the pictures itself,
          // so the transcript draws them from there — but until it does, these previews are what is on
          // the screen, and revoking them earlier blanks the question somebody is still looking at.
          pictures.clear()
        },
        // ⚠️ The conversation is deliberately left exactly as it was. A turn that never reached the model
        // changed nothing, and dropping the question back into the box is what lets somebody send it
        // again rather than retype it. The attachments stay for the same reason — they were uploaded
        // once and are still perfectly good.
        onError: () => {
          setDraft(question)
          setAsked(null)
        },
      },
    )
  }

  function restart() {
    setMessages([])
    setTurns([])
    setAsked(null)
    pictures.clear()
    ask.reset()
  }

  if (availability.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  if (availability.data?.available === false) {
    return <NoModelConfigured />
  }

  return (
    // ⚠️ The pane is the scroller, not the page — the composer stays pinned while the transcript moves
    // under it. See ApplicationLayout: the content wrapper bounds this, so `min-h-0` is what makes the
    // overflow land here rather than growing the document.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4">
          {entries.length === 0 && !asked && <Opening onPick={send} />}

          <AssistantTranscript
            entries={entries}
            turns={turns}
            pending={pending}
            busy={ask.isPending}
            onConfirm={send}
          />

          {asked && (
            <div className="flex flex-col items-end gap-2">
              {asked.previews.length > 0 && <Thumbnails previews={asked.previews} />}
              <p className="max-w-[80%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
                {asked.text}
              </p>
              <span className="self-start text-xs text-muted-foreground">
                Working — it may look a few things up first.
              </span>
            </div>
          )}

          {ask.isError && <TurnFailed error={ask.error} />}

          <div ref={bottom} />
        </div>
      </div>

      <Composer
        value={draft}
        busy={ask.isPending}
        canRestart={messages.length > 0}
        pictures={pictures}
        onChange={setDraft}
        onSend={() => send(draft)}
        onRestart={restart}
      />
    </div>
  )
}

/** A question on its way, held here only until the answer comes back carrying it. */
interface AskedTurn {
  text: string
  previews: string[]
}

/**
 * A photograph waiting to go with the next question.
 *
 * ⚠️ **It is already a file in the account's cabinet by the time it is here.** Uploading on pick rather
 * than on send is what makes an oversized or unsupported picture a refusal somebody can act on
 * immediately, instead of one that arrives after they have written a paragraph — and it means the
 * question carries an identifier rather than bytes.
 */
interface PendingPicture {
  fileId: string
  name: string
  /** An object URL over the chosen file. Drawn until the answer comes back carrying the real block. */
  preview: string
}

interface PendingPictures {
  attached: PendingPicture[]
  isUploading: boolean
  /** Why the last pick did not attach, in the backend's own words, or null. */
  failure: string | null
  limits: AttachmentLimits | undefined
  attach: (chosen: FileList | null) => void
  detach: (fileId: string) => void
  clear: () => void
}

/**
 * The pictures for the next question — uploaded, listed, and released when they are no longer drawn.
 *
 * ⚠️ **The ceiling and the accepted types come from `limits` and are never written here.** They are the
 * backend's rules; a copy in this file would be offered to somebody long after the backend stopped
 * agreeing with it, and the way they would find out is by being refused after uploading.
 */
function usePendingPictures(limits: AttachmentLimits | undefined): PendingPictures {
  const cabinet = useAuthStore((state) => state.user?.filesRootId)

  const [attached, setAttached] = useState<PendingPicture[]>([])
  const [isUploading, setUploading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // ⚠️ Every object URL this component minted is released when it goes away. They are held by the
  // document rather than by the element drawing them, so a conversation somebody attaches to all
  // afternoon leaks every photograph they ever picked until the tab is closed.
  useEffect(() => {
    return () => {
      attached.forEach((picture) => URL.revokeObjectURL(picture.preview))
    }
  }, [attached])

  function attach(chosen: FileList | null) {
    const picked = Array.from(chosen ?? [])

    if (picked.length === 0 || !cabinet) {
      return
    }

    const room = (limits?.maximum ?? 0) - attached.length

    if (picked.length > room) {
      setFailure(
        room === 0
          ? `That is as many pictures as one question can carry (${limits?.maximum}). Send this one, then attach more.`
          : `There is room for ${room} more picture${room === 1 ? "" : "s"} on this question.`,
      )

      return
    }

    setFailure(null)
    setUploading(true)

    Promise.all(picked.map((file) => filesApi.upload(fileOwner.directory(cabinet), file)))
      .then((responses) => {
        setAttached((existing) => [
          ...existing,
          ...responses.map((response, position) => ({
            fileId: response.data.id,
            name: response.data.name,
            preview: URL.createObjectURL(picked[position]),
          })),
        ])
      })
      .catch((error) => setFailure(problemDetailOf(error).detail ?? "That picture could not be uploaded."))
      .finally(() => setUploading(false))
  }

  function detach(fileId: string) {
    setAttached((existing) => {
      existing.filter((picture) => picture.fileId === fileId).forEach((picture) => URL.revokeObjectURL(picture.preview))

      return existing.filter((picture) => picture.fileId !== fileId)
    })
  }

  function clear() {
    setAttached((existing) => {
      existing.forEach((picture) => URL.revokeObjectURL(picture.preview))

      return []
    })
  }

  return { attached, isUploading, failure, limits, attach, detach, clear }
}

/** The pictures on a question that has been sent but not yet answered. */
function Thumbnails({ previews }: { previews: string[] }) {
  return (
    <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
      {previews.map((preview) => (
        <img key={preview} src={preview} alt="" className="h-28 w-28 rounded-md border object-cover" />
      ))}
    </div>
  )
}

/**
 * What is about to be sent with the question, and the way to take one back out.
 *
 * The name is under each one because a photograph off a phone is `IMG_4821.jpg` and the thumbnail of a
 * component on a bench looks much like the thumbnail of the component beside it.
 */
function AttachedStrip({ pictures }: { pictures: PendingPictures }) {
  return (
    <div className="flex flex-wrap gap-2">
      {pictures.attached.map((picture) => (
        <div key={picture.fileId} className="flex flex-col gap-1">
          <div className="relative">
            <img src={picture.preview} alt="" className="h-20 w-20 rounded-md border object-cover" />
            <button
              type="button"
              aria-label={`Remove ${picture.name}`}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-xs leading-none shadow-sm transition-colors hover:bg-accent"
              onClick={() => pictures.detach(picture.fileId)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="max-w-20 truncate text-[10px] text-muted-foreground" title={picture.name}>
            {picture.name}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Why the turn did not happen, in the words of whoever refused it.
 *
 * ⚠️ **The backend's own sentence, never a replacement for it.** This said "that did not get through" to
 * every failure alike, which covered a per-minute token limit, a key that is not a key and a model that
 * no longer exists with one sentence that names none of them — while the provider had already written a
 * usable explanation and sent it. The three have three different next moves and only one of them is
 * "send it again".
 */
function TurnFailed({ error }: { error: unknown }) {
  const { title, detail } = problemDetailOf(error)

  return (
    <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <strong className="text-destructive">{title}</strong>
      {detail && <span>{detail}</span>}
      <span className="text-xs text-muted-foreground">Your question is back in the box — send it again.</span>
    </div>
  )
}

interface ComposerProperties {
  value: string
  busy: boolean
  canRestart: boolean
  pictures: PendingPictures
  onChange: (value: string) => void
  onSend: () => void
  onRestart: () => void
}

/**
 * The box, pinned to the bottom.
 *
 * Enter sends and Shift+Enter breaks a line — the convention everywhere a message is composed. The
 * alternative traps somebody who wants a second paragraph into pressing a button they have to reach for,
 * and this is a box people type paragraphs into.
 */
function Composer({ value, busy, canRestart, pictures, onChange, onSend, onRestart }: ComposerProperties) {
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  const room = (pictures.limits?.maximum ?? 0) - pictures.attached.length

  // ⚠️ It grows with what is in it, and stops. Two fixed rows hide the end of anything longer than a
  // sentence, and an unbounded box eventually pushes the answer somebody is reading off the top of the
  // screen to make room for a draft.
  useEffect(() => {
    const element = box.current

    if (element === null) {
      return
    }

    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`
  }, [value])

  return (
    <div className="flex-shrink-0 border-t pt-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {pictures.attached.length > 0 && <AttachedStrip pictures={pictures} />}

        {pictures.failure && <p className="text-xs text-destructive">{pictures.failure}</p>}

        <Textarea
          ref={box}
          className="resize-none text-sm"
          value={value}
          rows={2}
          placeholder="Ask about your inventory, forms, pages or files…"
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              onSend()
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* ⚠️ `accept` is the served list, joined — never a list written here. See `usePendingPictures`. */}
          <input
            ref={picker}
            type="file"
            multiple
            className="hidden"
            accept={pictures.limits?.types.join(",")}
            onChange={(event) => {
              pictures.attach(event.target.files)
              // ⚠️ Cleared so that picking the SAME file again still fires a change. Without this, a
              // photograph removed and re-picked does nothing at all, silently.
              event.target.value = ""
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={room > 0 ? "Attach a photograph to look at" : "That is as many as one question can carry"}
            disabled={busy || pictures.isUploading || room <= 0}
            onClick={() => picker.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            {pictures.isUploading ? "Uploading…" : "Attach"}
          </Button>

          {canRestart && (
            <Button type="button" variant="ghost" size="sm" onClick={onRestart} disabled={busy}>
              New conversation
            </Button>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">Enter sends · Shift+Enter for a new line</span>
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            disabled={busy || pictures.isUploading || value.trim().length === 0}
          >
            {busy ? "Asking…" : "Ask"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * What to ask, for somebody who has never asked anything.
 *
 * Three openings rather than a paragraph explaining what an assistant is. The useful thing to know about
 * this one is that it can *look things up in here*, which a person learns in one press and not from
 * being told.
 */
function Opening({ onPick }: { onPick: (question: string) => void }) {
  const openings = [
    "Which workspaces can I reach, and what is in them?",
    "Find every entry whose quantity is below ten.",
    "What forms exist in my current workspace, and what do they collect?",
  ]

  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
      <h2 className="font-display text-base font-semibold">Ask about your own records</h2>
      <p className="text-sm text-muted-foreground">
        It reads and writes as you — the same permissions, the same workspaces, nothing more. Anything that
        removes or overwrites data is shown to you first, and waits.
      </p>
      <div className="flex flex-wrap gap-2">
        {openings.map((opening) => (
          <button
            key={opening}
            type="button"
            className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent"
            onClick={() => onPick(opening)}
          >
            {opening}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * ⚠️ An installation with tools and no provider is a supported arrangement, not a broken one — a
 * connected client reaches every action exactly as before. So this says which half is missing.
 */
function NoModelConfigured() {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed p-6">
      <span aria-hidden="true" className="text-2xl">
        ◍
      </span>
      <h3 className="text-sm font-medium">No model is configured here</h3>
      <p className="text-sm text-muted-foreground">
        The assistant needs a provider to speak through, and this installation has not been given one. The
        tools themselves are unaffected — a connected client still reaches every one of them. An
        administrator switches it on under <code className="font-mono text-xs">/admin/ai</code>.
      </p>
    </div>
  )
}
