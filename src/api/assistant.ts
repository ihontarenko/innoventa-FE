import { http } from "./http"
import type { AssistantMessage } from "@/lib/assistantTranscript"

/**
 * One turn of the conversation.
 *
 * ⚠️ **The browser holds the history and the server holds none of it.** Every question carries the whole
 * conversation back, and the answer returns the whole of it again — grown by what the assistant said and
 * by whatever the tools returned. That is deliberate: a stored conversation contains this person's own
 * records copied into a second place with a second lifetime, and deciding that is a separate question
 * from making the assistant work.
 *
 * ⚠️ Which means a reload is a new conversation. Nothing is lost that was ever written down.
 */
export interface AssistantAsk {
  question: string
  /** Exactly what the previous answer returned; empty opens a new conversation. */
  messages: AssistantMessage[]
  /**
   * Files to look at while answering — **identifiers, never bytes**.
   *
   * ⚠️ The picture is uploaded into the account's own file cabinet first, through the ordinary route,
   * and only its id travels with the question. So a photograph the assistant read is one that shows up
   * on the Files screen and can be deleted there — rather than a second, invisible store of somebody's
   * photographs that this feature would otherwise have created by accident.
   *
   * Photographs and screenshots only; the backend refuses anything else, with the reason.
   */
  attachments: string[]
}

export interface AssistantAnswer {
  answer: string
  messages: AssistantMessage[]
  /**
   * False when the assistant ran out of rounds or tokens part-way through — the answer is then a
   * description of where it stopped rather than a result, and the screen says so rather than presenting
   * an interrupted task as a finished one.
   */
  finished: boolean
  toolCalls: number
  inputTokens: number
  outputTokens: number
}

/**
 * What may be attached to a question.
 *
 * ⚠️ **Served, never repeated here.** The ceiling and the acceptable types are the backend's rules, and
 * a copy of them written into this interface would go stale in silence — the picker would offer a type
 * the backend refuses, and somebody would find out after uploading a photograph.
 */
export interface AttachmentLimits {
  maximum: number
  /** Media types, e.g. `image/png` — exactly what a file input's `accept` wants. */
  types: string[]
}

export interface AssistantAvailability {
  /**
   * Whether this installation has a model configured at all.
   *
   * ⚠️ An installation with tools and no provider is a supported arrangement — a connected client still
   * works perfectly — so the screen is drawn **absent** rather than present and broken. A chat box that
   * answers every message with the same configuration error is worse than no chat box.
   */
  available: boolean
  attachments: AttachmentLimits
}

export const assistantApi = {
  ask: (payload: AssistantAsk) => http.post<AssistantAnswer>("/assistant/ask", payload),

  availability: () => http.get<AssistantAvailability>("/assistant/availability"),
}
