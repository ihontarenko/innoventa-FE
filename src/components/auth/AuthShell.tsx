import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { InnoventaMark } from "@/components/icons/InnoventaMark"

/**
 * The frame every signed-out screen sits in.
 *
 * ⚠️ **One shell for all six of them** — sign in, register, verify, magic link, the OAuth2 hand-off and
 * whatever comes next. They were six centred cards that had each grown their own spacing, and the drift
 * showed as the card jumping half a centimetre when somebody clicked "Create an account".
 *
 * ⚠️ **The brand panel is hidden below `lg`, not shrunk.** On a phone it would be a screenful of
 * marketing above the field somebody came here to type in; the promise is worth making to a stranger
 * who has room for it and worth nothing to one who does not.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** The way out — "back to sign in", "already have an account". Always present, always the last thing. */
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1fr_minmax(420px,38%)]">
      <BrandPanel />

      <div className="flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-[12px] bg-primary text-primary-foreground">
              <InnoventaMark className="size-6" />
            </span>
            <span className="font-display text-base font-semibold tracking-[-0.02em]">Innoventa</span>
          </Link>

          <div className="flex flex-col gap-1">
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * ⚠️ **"Inventory that takes the shape of what you count", not "component stock management".**
 * Electronics is one subject area of several and a workspace decides which it counts — so a promise made
 * in the product's own name has to be the one thing true of *every* workspace, or it is a promise the
 * second workspace somebody makes already breaks.
 */
function BrandPanel() {
  const promises = [
    "Components, tools, samples, assets — your own fields",
    "Full inventory with search and filters",
    "Team workspaces with role-based access",
  ]

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
      {/* Two soft washes rather than an image: no asset to load, and it takes the palette with it
          through all 29 themes instead of being one fixed blue in every one of them. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(60%_50%_at_15%_10%,white,transparent),radial-gradient(50%_40%_at_85%_90%,white,transparent)]"
      />

      <Link to="/" className="relative flex items-center gap-2.5">
        <InnoventaMark className="size-9" />
        <span className="font-display text-lg font-semibold tracking-[-0.02em]">Innoventa</span>
      </Link>

      <div className="relative flex flex-col gap-6">
        <p className="font-display text-3xl leading-tight font-semibold tracking-[-0.03em]">
          Inventory that takes
          <br />
          the shape of what you count.
        </p>

        <ul className="flex flex-col gap-2.5 text-sm opacity-90">
          {promises.map((promise) => (
            <li key={promise} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-0.5 shrink-0">
                ✓
              </span>
              {promise}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs opacity-70">Forms, inventory, entries.</p>
    </div>
  )
}

/** The one alert shape these screens use — success, failure and plain notice differ only in colour. */
export function AuthNotice({ tone, children }: { tone: "success" | "error" | "info"; children: ReactNode }) {
  const skin = {
    success: "border-success/40 bg-success/10",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-border bg-muted/50",
  }[tone]

  return <div className={`rounded-md border p-3 text-sm ${skin}`}>{children}</div>
}
