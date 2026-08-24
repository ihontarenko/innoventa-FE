import { useAuthStore } from "@/stores/authStore"
import { Capabilities } from "./sections/Capabilities"
import { Closing } from "./sections/Closing"
import { Connect } from "./sections/Connect"
import { Hero } from "./sections/Hero"
import { HowItWorks } from "./sections/HowItWorks"
import { Navigation } from "./sections/Navigation"
import { ShapeDemo } from "./sections/ShapeDemo"

/**
 * The only page a stranger sees before deciding whether to bother.
 *
 * ⚠️ **Reworked rather than ported (`INVT-0080`).** The old one was 299 lines in a single file, and its
 * hero promised "Forms, inventory & results **for engineering teams**" while its own footer promised
 * "inventory that takes the shape of what you count". Two promises, and the louder one was the narrow
 * one — the same mistake as calling the product "component stock management", which a workspace
 * counting lab samples breaks on its first day.
 *
 * ⚠️ **It shows the product instead of describing it.** `ShapeDemo` is the centrepiece: one form engine
 * visibly becoming three different forms. Eight cards of prose could not make that claim, which is
 * exactly why there used to be eight cards.
 *
 * ⚠️ **Nothing here needs a session and nothing here needs a token.** Theme, fonts and every section
 * paint with the backend down; the only server-shaped thing on the page is the three embedded forms at
 * the bottom, which are iframes and fail on their own without taking the page with them.
 */
export function LandingPage() {
  // ⚠️ Read, not required. Every call to action swaps to its signed-in wording — this is the address
  // people reach from a bookmark, so a reader who already has three workspaces is common.
  const authenticated = useAuthStore((state) => !!state.accessToken)

  return (
    <div className="min-h-svh bg-background">
      <Navigation authenticated={authenticated} />
      <Hero authenticated={authenticated} />
      <ShapeDemo />
      <Capabilities />
      <HowItWorks />
      <Connect />
      <Closing authenticated={authenticated} />
    </div>
  )
}
