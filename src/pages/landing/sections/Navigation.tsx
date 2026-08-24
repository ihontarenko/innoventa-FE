import { Link } from "react-router-dom"
import { Button } from "@jmouse/ui"
import { InnoventaMark } from "@/components/icons/InnoventaMark"
import { PLATFORM_HOME_PATH } from "@/lib/navigationContext"

/**
 * ⚠️ **It knows whether you are signed in, and changes both buttons when you are.** A landing page that
 * offers "Get started" to somebody who already has an account and three workspaces is a page that has
 * not looked at who is reading it — and this is the address people land on from a bookmark, so that
 * reader is common rather than rare.
 *
 * ⚠️ **No `Manual` link.** The manual is two embedded category trees, and categories are moving to Kiwi
 * (`KW-13`). A menu entry pointing at an unported screen is worse than one absence.
 */
export function Navigation({ authenticated }: { authenticated: boolean }) {
  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2" aria-label="Innoventa home">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <InnoventaMark className="size-5" />
          </span>
          <span className="font-display text-sm font-semibold tracking-[-0.02em]">Innoventa</span>
        </Link>

        <div className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <a href="#shape" className="transition-colors hover:text-foreground">
            How it fits
          </a>
          <a href="#capabilities" className="transition-colors hover:text-foreground">
            What it does
          </a>
          <a href="#connect" className="transition-colors hover:text-foreground">
            Contact
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={authenticated ? PLATFORM_HOME_PATH : "/auth/login"}>
              {authenticated ? "Go to app" : "Sign in"}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={authenticated ? PLATFORM_HOME_PATH : "/auth/register"}>
              {authenticated ? "Open workspace" : "Get started"}
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
