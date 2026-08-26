import type { CSSProperties, ReactNode } from "react"
import { InnoventaMark } from "@/components/icons/InnoventaMark"

/**
 * The frame a shared link renders in.
 *
 * ⚠️ **This is the only surface with no session, and it has to survive that completely.** No token, no
 * workspace, no permissions, no `/api/me`. The theme, the fonts and the type scale all come from CSS
 * that is already in the bundle — a public page that waited on a request before it could decide its own
 * colours would flash, and a public page that *failed* on one would be blank.
 */
export function PublicSurface({
  accentColour,
  wide = false,
  children,
}: {
  /** A form's own colour, if it set one. ⚠️ Overrides `--primary` for this subtree only. */
  accentColour?: string | null
  /**
   * Room for a document rather than for prose.
   *
   * ⚠️ **A measure is a reading decision, and the two readings differ.** A form or a record is read down
   * a column, and 2xl is about as wide as a line may run before the eye loses it. A 118-page PDF is not
   * read that way at all — it is scanned, and squeezing it into a column of prose makes every page
   * unreadable to save a rule that was never about documents.
   */
  wide?: boolean
  children: ReactNode
}) {
  const accented = accentColour
    ? ({ "--primary": accentColour, "--ring": accentColour } as CSSProperties)
    : undefined

  return (
    <div className="flex min-h-svh flex-col bg-muted/30" style={accented}>
      <header className="flex items-center gap-2 border-b bg-background px-5 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <InnoventaMark className="size-5" />
        </span>
        <span className="font-display text-sm font-semibold tracking-[-0.02em]">Innoventa</span>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
        <div className={wide ? "w-full max-w-6xl" : "w-full max-w-2xl"}>{children}</div>
      </main>
    </div>
  )
}

/**
 * What a visitor is told when a link does not resolve.
 *
 * ⚠️ **It never says why, and that is on purpose.** "Revoked", "expired" and "never existed" are three
 * different facts about somebody else's data, and telling them apart to an anonymous visitor is a way of
 * confirming that a resource exists to somebody who was not given the link.
 */
export function PublicNotice({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-background p-10 text-center">
      <span aria-hidden="true" className="text-3xl">
        {icon}
      </span>
      <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

/** The one line at the foot of a shared page. ⚠️ A link out, never a call to action. */
export function PoweredBy() {
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      Powered by{" "}
      <a href="/" className="underline underline-offset-2 hover:text-foreground">
        Innoventa
      </a>
    </p>
  )
}

/**
 * The one thing every dead public link says.
 *
 * ⚠️ **One component, not four sentences that drifted apart.** A revoked form, a deleted record, a file
 * whose sharing was switched off and an address nobody ever minted are four different facts to the
 * server and exactly one fact to the visitor: *this link does not resolve*. Four screens wording that
 * four ways is how one of them ends up leaking which of the four it was.
 *
 * ⚠️ **It never says why.** "Revoked", "expired" and "never existed" are three different statements
 * about somebody else's data, and telling them apart to an anonymous visitor confirms a resource exists
 * to somebody who was not given the link.
 */
/**
 * The one sentence every dead public link carries.
 *
 * ⚠️ **Exported so the four surfaces cannot drift.** They said four different things — one of them,
 * "it may never have been public", told an anonymous visitor which of the causes it was.
 */
export const UNAVAILABLE_BLURB =
  "It may have been revoked, or sharing may have been switched off for it. If somebody sent you this address, ask them for a new one."

export function PublicAccessError({ what = "link" }: { what?: string }) {
  return (
    <PublicSurface>
      <PublicNotice icon="🔗" title={`This ${what} is not available`}>
        {UNAVAILABLE_BLURB}
      </PublicNotice>

      <PoweredBy />
    </PublicSurface>
  )
}
