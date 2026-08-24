import { AxiosError } from "axios"

/** The RFC 7807 {@code detail} message off a failed request, or a fallback — shown in a toast. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof AxiosError) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail

    if (typeof detail === "string" && detail.length > 0) {
      return detail
    }
  }

  return fallback
}
