import { create } from "zustand"
import { persist } from "zustand/middleware"
import { restoreAdministrator, stashAdministrator } from "@/api/impersonationStash"
import { IMPERSONATION_STORE_KEY } from "@/api/tokenStorage"
import type { ImpersonationSessionView } from "@/api/admin"
import { useAuthStore } from "./authStore"

/**
 * The session an administrator is currently working inside of.
 *
 * Persisted, so the session survives a page reload — an administrator reproducing a problem will
 * refresh, and losing the borrowed identity halfway through would mean starting over. What it holds is
 * only what the banner needs: who is being worked as, and until when.
 *
 * ⚠️ The credentials themselves are not here. They live in the stash module, which the HTTP client can
 * also reach while handling the 401 that an expired session produces.
 */
interface ImpersonationState {
  session: ImpersonationSessionView | null

  /** Stashes the administrator's own tokens, then adopts the borrowed one. */
  begin: (session: ImpersonationSessionView) => void

  /**
   * Puts the administrator back.
   *
   * @returns whether the stash was still there. False means a fresh sign-in — there is deliberately no
   *          endpoint that would mint an administrator token instead.
   */
  end: () => boolean
}

export const useImpersonationStore = create<ImpersonationState>()(
  persist(
    (set) => ({
      session: null,

      begin: (session) => {
        // Stashed first, because adopting the borrowed token overwrites what is being stashed.
        stashAdministrator()

        // ⚠️ No refresh token: the borrowed session expires on its own and cannot renew itself, and
        // leaving the administrator's own one in place would let the 401 that its expiry produces
        // silently refresh straight back into administrative access.
        useAuthStore.getState().setTokens(session.accessToken, "")

        set({ session })
      },

      // `restoreAdministrator` forgets the stash and the session either way, so there is nothing left
      // to clean up when it reports there was nothing to restore.
      end: () => {
        const restored = restoreAdministrator()

        set({ session: null })

        return restored
      },
    }),
    {
      name: IMPERSONATION_STORE_KEY,
      partialize: (state) => ({ session: state.session }),
    },
  ),
)
