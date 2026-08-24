import { Link } from "react-router-dom"
import { Button } from "@jmouse/ui"
import { InnoventaMark } from "@/components/icons/InnoventaMark"
import { PLATFORM_HOME_PATH } from "@/lib/navigationContext"

/** The last ask, and the footer under it. */
export function Closing({ authenticated }: { authenticated: boolean }) {
  return (
    <>
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-5 py-20 text-center">
          <h2 className="max-w-xl font-display text-3xl font-semibold tracking-[-0.03em]">
            What are you counting?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Make a workspace, declare one thing, and see whether it fits. It takes about a minute and
            costs nothing.
          </p>
          <Button size="lg" asChild>
            <Link to={authenticated ? PLATFORM_HOME_PATH : "/auth/register"}>
              {authenticated ? "Open workspace" : "Create your workspace"}
            </Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="grid gap-8 sm:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <InnoventaMark className="size-5" />
              </span>
              <span className="font-display text-sm font-semibold tracking-[-0.02em]">Innoventa</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Inventory that takes the shape of what you count.
            </p>
          </div>

          <FooterColumn title="Product">
            <a href="#shape" className="hover:text-foreground">
              How it fits
            </a>
            <a href="#capabilities" className="hover:text-foreground">
              What it does
            </a>
            <a href="#connect" className="hover:text-foreground">
              Contact
            </a>
          </FooterColumn>

          <FooterColumn title="Account">
            <Link to={authenticated ? PLATFORM_HOME_PATH : "/auth/login"} className="hover:text-foreground">
              {authenticated ? "My workspace" : "Sign in"}
            </Link>
            <Link to={authenticated ? "/settings" : "/auth/register"} className="hover:text-foreground">
              {authenticated ? "Settings" : "Create account"}
            </Link>
          </FooterColumn>
        </div>

        {/* ⚠️ `new Date()` at render, deliberately: a hard-coded year on a footer is wrong for eleven
            months out of twelve, and this is the one place in the product where the clock is harmless. */}
        <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Innoventa
        </p>
      </footer>
    </>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium">{title}</p>
      <nav className="flex flex-col gap-1.5 text-sm text-muted-foreground">{children}</nav>
    </div>
  )
}
