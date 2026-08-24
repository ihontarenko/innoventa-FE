import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SpaceSummary } from "@/types"

/**
 * The workspace two questions are asked about, and they are not the same question.
 *
 * **Active** is what the address says, and it is genuinely *absent* outside the workspace context
 * rather than stale. It is never persisted: a stored active workspace outlives the navigation that set
 * it, and the first request on the next screen would go out carrying a workspace that screen shows
 * nothing of. It is what feeds the `X-Space-Id` header.
 *
 * **Last visited** is persisted, and is only ever read to answer "where should a flat address go?".
 */
interface SpaceState {
  /** What `X-Space-Id` carries. */
  activeSpaceId: string | null
  /** What an in-workspace address is built from. */
  activeSpaceSlug: string | null
  lastVisitedSpaceSlug: string | null
  enterSpace: (space: SpaceSummary) => void
  leaveSpace: () => void
}

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set) => ({
      activeSpaceId: null,
      activeSpaceSlug: null,
      lastVisitedSpaceSlug: null,

      // ⚠️ The name is deliberately not here. A name kept in a store is the copy that goes stale the
      // moment somebody renames the workspace; whatever draws it reads the workspace itself.
      enterSpace: (space) =>
        set({
          activeSpaceId: space.id,
          activeSpaceSlug: space.slug,
          lastVisitedSpaceSlug: space.slug,
        }),

      leaveSpace: () => set({ activeSpaceId: null, activeSpaceSlug: null }),
    }),
    {
      name: "innoventa.space",
      version: 2,
      partialize: (state) => ({ lastVisitedSpaceSlug: state.lastVisitedSpaceSlug }),
    },
  ),
)
