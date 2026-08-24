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
  children,
}: {
  /** A form's own colour, if it set one. ⚠️ Overrides `--primary` for this subtree only. */
  accentColour?: string | null
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
        <div className="w-full max-w-2xl">{children}</div>
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
