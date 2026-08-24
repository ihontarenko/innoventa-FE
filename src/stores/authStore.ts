import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AUTH_STORE_KEY, clearTokens, saveTokens } from "@/api/tokenStorage"
import type { AccessRequirement } from "@/navigation"
import type { UserProfile } from "@/types"

interface AuthState {
  user: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  /** What a second factor leaves behind: proof of a password, not of a session. */
  pendingToken: string | null
  setUser: (user: UserProfile) => void
  setTokens: (access: string, refresh: string) => void
  setPendingToken: (token: string) => void
  clearPendingToken: () => void
  logout: () => void
  isAuthenticated: () => boolean
  holdsSomewhere: (permission: string) => boolean
  holdsEverywhere: (permission: string) => boolean
  holds: (requirement: AccessRequirement) => boolean
}

/**
 * Who is signed in — and nothing about what they may do beyond repeating what the server already said.
 *
 * ⚠️ **Every permission here is an offer, never an authority.** It exists so the product stops
 * offering what it is about to refuse; the same call is checked again server-side, every time.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      pendingToken: null,

      setUser: (user) => set({ user }),

      setTokens: (access, refresh) => {
        saveTokens(access, refresh)
        set({ accessToken: access, refreshToken: refresh })
      },

      setPendingToken: (token) => set({ pendingToken: token }),
      clearPendingToken: () => set({ pendingToken: null }),

      logout: () => {
        clearTokens()
        set({ user: null, accessToken: null, refreshToken: null, pendingToken: null })
      },

      isAuthenticated: () => !!get().accessToken,

      /**
       * Whether this account may do it **somewhere**.
       *
       * Right for offering an action that exists in some workspace. Wrong for anything about the
       * installation — every ordinary user holds `space:read` in the workspaces they belong to, so this
       * answers yes for all of them.
       */
      holdsSomewhere: (permission) => get().user?.permissions?.includes(permission) ?? false,

      /**
       * Whether this account may do it **everywhere** — the platform-level question, resolved at
       * `GLOBAL`. It is the distinction that let `space:administer` stop existing: administering one
       * workspace and administering every workspace were two permissions only because nothing could say
       * the difference.
       */
      holdsEverywhere: (permission) => get().user?.installationPermissions?.includes(permission) ?? false,

      /**
       * Whether this account holds what a destination asks for — **the only reader of that declaration.**
       *
       * ⚠️ **The two above are the raw questions; this is the one that answers a gate.** Which of them
       * applies is written on the destination, next to the permission name, and read here — so the
       * sidebar, the personalisation tab and the screen itself cannot come to different conclusions
       * about the same row. They did: the Assistant declared `assistant:use` without saying which set,
       * the menu asked "somewhere", the screen asked "everywhere", and the result was a working screen
       * with no way to reach it.
       *
       * A destination that asks for nothing is open — no permission means no gate, not an empty one.
       */
      holds: (requirement) => {
        if (!requirement.requiredPermission) {
          return true
        }

        return requirement.requiredEverywhere
          ? get().holdsEverywhere(requirement.requiredPermission)
          : get().holdsSomewhere(requirement.requiredPermission)
      },
    }),
    {
      name: AUTH_STORE_KEY,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)
