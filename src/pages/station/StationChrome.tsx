import type { ReactNode } from "react"
import { CloudOff } from "lucide-react"
import { Badge } from "@jmouse/ui"

export interface StationChromeProperties {
  title: string
  /** Sits before the title — a back control, where the station has somewhere to go back to. */
  leading?: ReactNode
  offline?: boolean
  pendingCount?: number
  children: ReactNode
}

/**
 * The frame every station wears, and the reason it is not `ApplicationLayout`.
 *
 * <h2>⚠️ Standalone removes two things silently</h2>
 *
 * <p><strong>There is no way out.</strong> Launched from a home screen there is no back button, no
 * address bar and no tab strip, so every dead end needs its own route home or the person force-quits
 * the application. That is why {@link StationChromeProperties#leading} exists and why a station's
 * screens are shallow.
 *
 * <p><strong>The window reaches the physical edges of the display.</strong> A title bar without the
 * safe-area insets sits under the notch and a control at the bottom sits under the home indicator.
 * Both are invisible in a desktop tab and obvious the first time somebody installs it — which is why
 * the insets are here rather than remembered per screen.
 *
 * <h2>⚠️ The network state is on screen, always</h2>
 *
 * <p>A station that quietly stops saving is the worst version of this feature. Offline is said out
 * loud, and anything waiting to be sent is counted beside it — a number that looks settled and is not
 * is worse than an obvious "waiting".
 */
export function StationChrome({ title, leading, offline, pendingCount = 0, children }: StationChromeProperties) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header
        className="border-border bg-card sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2.5"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        {leading}
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{title}</p>

        {offline && (
          <Badge variant="secondary" className="gap-1 text-[10.5px]">
            <CloudOff className="size-3" />
            Offline
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-[10.5px]">
            {pendingCount} waiting
          </Badge>
        )}
      </header>

      <main className="flex-1" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {children}
      </main>
    </div>
  )
}
