import { Link } from "react-router-dom"
import { Button } from "@jmouse/ui"
import { PLATFORM_HOME_PATH } from "@/lib/navigationContext"

/**
 * The promise, and it is the one sentence the whole product has to be able to keep.
 *
 * ⚠️ **"Inventory that takes the shape of what you count" — word for word what `AuthShell` says.** Two
 * different promises on two screens of one product is a product nobody can describe back to you, and
 * these are the two screens a stranger sees first and second.
 *
 * ⚠️ **The old hero said "for engineering teams" and called the product a "schema-driven data
 * platform".** Both are the same mistake in different registers: the first narrows a promise that a
 * workspace counting lab samples already breaks, and the second describes the mechanism to somebody who
 * has not yet been told what it is for. A subject area is a setting, not the audience.
 */
export function Hero({ authenticated }: { authenticated: boolean }) {
  return (
    <section className="relative overflow-hidden border-b">
      {/* Two soft washes rather than an image — nothing to load, and it takes the palette with it
          through all 29 themes instead of being one fixed blue in every one of them. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background:radial-gradient(50%_60%_at_20%_0%,var(--primary),transparent),radial-gradient(40%_50%_at_85%_100%,var(--chart-2),transparent)]"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-20 sm:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Forms, inventory, entries
        </span>

        <h1 className="max-w-3xl font-display text-4xl leading-[1.08] font-semibold tracking-[-0.035em] sm:text-6xl">
          Inventory that takes
          <br />
          <span className="text-primary">the shape of what you count.</span>
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Describe the thing once — its fields, its units, its rules — and you get the form, the
          inventory, the search and the sharing for free. Components, tools, samples, assets: the
          product does not need to know which, and neither does the next workspace you make.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link to={authenticated ? PLATFORM_HOME_PATH : "/auth/register"}>
              {authenticated ? "Open workspace" : "Get started free"}
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#shape">See how it fits</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
