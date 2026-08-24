import type { ReactNode } from "react"
import { Badge } from "@jmouse/ui"

/**
 * What a panel says to somebody who may read this screen but not change it.
 *
 * ⚠️ **Written once because two panels refuse for the same reason and must not word it differently.**
 * Reading what the AI does and deciding what it does are two permissions on purpose; a reader told
 * "no access" on one tab and "ask an administrator" on another concludes the two are different problems.
 */
export function NotAdministering({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed p-6">
      <span aria-hidden="true" className="text-2xl">
        ⊘
      </span>
      <span className="text-sm font-medium">Reading is not administering</span>
      <p className="text-xs text-muted-foreground">{children}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Needs</span>
        <Badge variant="secondary" className="font-mono text-[11px]">
          ai:administer
        </Badge>
      </div>
    </div>
  )
}
