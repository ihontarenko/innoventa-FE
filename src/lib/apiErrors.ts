/**
 * The sentence the server sent, where it sent one.
 *
 * ⚠️ **Its own module rather than a copy per screen.** Every refusal in this product is an RFC 7807
 * `ProblemDetail` whose `detail` is written for a person to read — and a screen that falls back to its
 * own wording without looking first replaces "'photo.png' cannot be deleted — it is your avatar" with
 * "Something went wrong", which is the one message that helps nobody.
 */
export function detailOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

/**
 * The whole of what the server said, not only its `detail`.
 *
 * ⚠️ **This lived in a second module for most of a session, and that is the bug it now fixes.**
 * `lib/problemDetail.ts` and this file both read the same RFC 7807 body — one written without looking
 * for the other — which is precisely the "three copies of the usage list" mistake that cost `PHANTOM`
 * its create option. One module, two functions: `detailOf` when a caller only wants the sentence,
 * this when it wants something to render.
 *
 * ⚠️ **It never throws.** A network failure has no body at all and a proxy can answer HTML — both are
 * ordinary, so the worst outcome is a vaguer title rather than a blank screen.
 */
export interface ProblemDetail {
  title: string
  detail?: string
}

const NETWORK = "The server could not be reached"
const UNKNOWN = "That did not go through"

export function problemDetailOf(error: unknown): ProblemDetail {
  const typed = error as {
    isNetworkError?: boolean
    message?: string
    response?: { status?: number; data?: unknown }
  }

  if (typed?.isNetworkError) {
    return { title: NETWORK, detail: "It may be restarting — try again in a moment." }
  }

  const body = typed?.response?.data

  if (typeof body === "string" && body.trim().length > 0 && !body.trimStart().startsWith("<")) {
    return { title: body.trim() }
  }

  if (body !== null && typeof body === "object") {
    const problem = body as Record<string, unknown>
    const title = readText(problem.title) ?? readText(problem.error) ?? readText(problem.message)
    const detail = readText(problem.detail)

    if (title || detail) {
      return { title: title ?? UNKNOWN, detail: title ? detail : undefined }
    }
  }

  return { title: UNKNOWN, detail: readText(typed?.message) }
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}
