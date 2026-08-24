import { useMemo } from "react"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { INERT_SURFACE } from "@/components/markdown/surface"
import { ConfirmationCard } from "./ConfirmationCard"
import type {
  AssistantAction,
  ConfirmationPreview,
  TranscriptEntry,
  TranscriptImage,
} from "@/lib/assistantTranscript"

/** What one exchange cost, kept beside the answer it paid for rather than totalled out of sight. */
export interface TurnRecord {
  /** The message this turn ended on — how a cost finds the answer it belongs to. */
  lastMessageIndex: number
  toolCalls: number
  inputTokens: number
  outputTokens: number
  finished: boolean
}

interface AssistantTranscriptProperties {
  entries: TranscriptEntry[]
  turns: TurnRecord[]
  /** The one preview still awaiting a decision, if there is one. */
  pending: ConfirmationPreview | null
  busy: boolean
  onConfirm: (instruction: string) => void
}

/** Which dot an action gets. ⚠️ A refusal and a preview are not the same colour — one stopped, one waits. */
const OUTCOME_DOT: Record<AssistantAction["outcome"], string> = {
  succeeded: "bg-success",
  refused: "bg-destructive",
  previewed: "bg-warning",
  pending: "bg-muted-foreground",
}

/**
 * The conversation, drawn.
 *
 * ⚠️ Everything here is derived from the message array the server returned — see `buildTranscript`.
 * Nothing is remembered locally about what was said, so the transcript cannot come to disagree with what
 * the model actually saw.
 */
export function AssistantTranscript({ entries, turns, pending, busy, onConfirm }: AssistantTranscriptProperties) {
  const costs = useMemo(() => costsByPosition(entries, turns), [entries, turns])

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry, position) => (
        <div key={entry.key} className="flex flex-col gap-2">
          {renderEntry(entry, pending, busy, onConfirm)}
          {costs.has(position) && <TurnCost record={costs.get(position)!} />}
        </div>
      ))}
    </div>
  )
}

function renderEntry(
  entry: TranscriptEntry,
  pending: ConfirmationPreview | null,
  busy: boolean,
  onConfirm: (instruction: string) => void,
) {
  switch (entry.kind) {
    case "question":
      return (
        <div className="flex flex-col items-end gap-2">
          {entry.images.length > 0 && <Pictures images={entry.images} align="end" />}
          {entry.text.length > 0 && (
            <p className="max-w-[80%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
              {entry.text}
            </p>
          )}
        </div>
      )

    case "pictures":
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">What it was handed to look at</span>
          <Pictures images={entry.images} align="start" />
        </div>
      )

    case "answer":
      // ⚠️ INERT_SURFACE, and this is a security decision rather than a styling one. The live `:::`
      // blocks resolve by calling the server for whatever they name, and this text was written by a
      // model. A resolving surface here would let an answer choose what the browser fetches; the
      // client-side directives — callouts, diagrams, maths — still render.
      return <PageMarkdown markdown={entry.text} surface={INERT_SURFACE} dense />

    case "actions":
      return (
        <ul className="flex flex-col gap-1.5">
          {entry.actions.map((action) => (
            <li key={action.toolUseId}>
              <ActionLine action={action} />
            </li>
          ))}
        </ul>
      )

    case "preview":
      return (
        <ConfirmationCard
          preview={entry.preview}
          action={entry.action}
          live={pending?.token === entry.preview.token}
          busy={busy}
          onConfirm={onConfirm}
        />
      )
  }
}

/**
 * The pictures in one turn, as thumbnails.
 *
 * ⚠️ **Exactly what the model was shown, drawn from the conversation itself.** The bytes are already in
 * the message — that is how they reached the model — so nothing is fetched. A thumbnail that went back
 * to the file cabinet for a second copy would quietly start disagreeing with the transcript the moment
 * the file was replaced, renamed or deleted, and the transcript is supposed to be the record.
 */
function Pictures({ images, align }: { images: TranscriptImage[]; align: "start" | "end" }) {
  return (
    <div className={`flex max-w-[80%] flex-wrap gap-2 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {images.map((image) => (
        <img
          key={image.key}
          src={image.dataUri}
          alt=""
          className="h-28 w-28 rounded-md border object-cover"
          loading="lazy"
        />
      ))}
    </div>
  )
}

/**
 * One action, on one line.
 *
 * What it did, where it did it, and — when it was refused — why, in the sentence the model was given.
 * Those refusals are written to be acted on rather than apologised for, so passing them through
 * unchanged tells the person the same useful thing it told the model.
 *
 * ⚠️ **The scope is on the line even when nothing went wrong.** Every answer is supposed to say where it
 * acted, including when a default supplied the workspace, and the difference between the wrong workspace
 * being noticed now and noticed next week is exactly this line.
 */
function ActionLine({ action }: { action: AssistantAction }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${OUTCOME_DOT[action.outcome]}`} />
        <code className="font-mono">{action.name}</code>

        {action.scope && (
          <span className="text-muted-foreground" title={`${action.scope.kind} scope`}>
            {action.scope.name}
            {action.scope.wasDefault && <em className="not-italic opacity-70"> by default</em>}
          </span>
        )}

        {action.reason && (
          <span className="ml-auto rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
            {action.reason.toLowerCase().replace(/_/g, " ")}
          </span>
        )}

        {action.outcome === "pending" && (
          <span className="ml-auto text-[11px] text-muted-foreground">never answered</span>
        )}
      </div>

      {action.refusal && <p className="text-xs text-destructive">{action.refusal}</p>}

      {action.payload && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground select-none">What came back</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded-sm bg-background p-2 font-mono text-[11px]">
            {action.payload}
          </pre>
        </details>
      )}
    </div>
  )
}

/**
 * Cost, beside the answer rather than in a corner of the header.
 *
 * An assistant spends somebody's money on their behalf. Showing what a turn cost where the turn is means
 * it is read rather than discovered, which is the whole reason the response carries it.
 */
function TurnCost({ record }: { record: TurnRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {!record.finished && (
        <span className="text-warning">
          Stopped before finishing — the answer above is where it got to, not a result.
        </span>
      )}
      <span className="ml-auto" />
      {record.toolCalls > 0 && (
        <span>
          {record.toolCalls} {record.toolCalls === 1 ? "action" : "actions"}
        </span>
      )}
      <span>{record.inputTokens + record.outputTokens} tokens</span>
    </div>
  )
}

/**
 * Where each turn's cost line goes: after the last thing that turn produced.
 *
 * A turn ends on an assistant message, which may have produced an answer, an action strip, or both — so
 * the position is found rather than assumed, and a turn whose final message drew nothing at all quietly
 * has no cost line rather than an orphaned one.
 */
function costsByPosition(entries: TranscriptEntry[], turns: TurnRecord[]): Map<number, TurnRecord> {
  const positions = new Map<number, TurnRecord>()

  turns.forEach((record) => {
    for (let position = entries.length - 1; position >= 0; position -= 1) {
      if (entries[position].index === record.lastMessageIndex) {
        positions.set(position, record)

        return
      }
    }
  })

  return positions
}
