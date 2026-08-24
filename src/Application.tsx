import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { QueryTransportProvider } from "@jmouse/query"
import { ThemeProvider, Toaster } from "@jmouse/ui"
import { repaintMark } from "@/lib/favicon"
import { allThemes } from "@jmouse/ui/presets"
import { queryClient } from "@/lib/queryClient"
import { ApplicationRoutes } from "@/router"
import { addressedTheme } from "@/lib/addressedTheme"
import { queryTransport } from "@/lib/queryTransport"

/**
 * ⚠️ **`storagePrefix="innoventa"` is load-bearing.** It writes `innoventa.theme-mode` and friends —
 * the same keys the old interface uses — so somebody who has picked a theme there finds it here, and
 * the two interfaces do not disagree about what the product looks like while both are running.
 *
 * The catalogue is the shared one because these 27 palettes were Innoventa's to begin with; what it
 * gains from the package is the `atlas` pair Tessera added.
 *
 * ⚠️ **The theme is read off the address here, at the provider, and nowhere else.** An embed carries its
 * look in its own URL because there is nobody signed in to have a preference — and the provider is the
 * only thing allowed to write the root element, so a screen applying a class in its own effect runs
 * first and is overwritten on the next paint. `initialOverrides` seeds and is never written back: whoever
 * opens somebody's embed in Dracula still finds their own theme where they left it.
 */
export function Application() {
  return (
    <ThemeProvider themes={allThemes} storagePrefix="innoventa" initialOverrides={addressedTheme()} onThemeApplied={repaintMark}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {/*
            ⚠️ At the root rather than beside each panel: the filter builder appears on several screens
            and every one of them must reach the backend through the SAME client — the one that refreshes
            the token and carries the workspace header.
          */}
          <QueryTransportProvider value={queryTransport}>
            <ApplicationRoutes />
          </QueryTransportProvider>
          <Toaster />
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
