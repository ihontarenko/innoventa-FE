import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Skeleton } from "@jmouse/ui"
import { useProfile } from "@/hooks/useProfile"
import { useAuthStore } from "@/stores/authStore"

/**
 * The door.
 *
 * ⚠️ **A token is enough to get in, and the profile decides nothing here.** Every route behind this is
 * gated server-side and refuses on its own; sending somebody to sign in because a profile request is
 * still in flight would bounce them out of a session they actually hold.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => !!state.accessToken)
  const location = useLocation()
  const { isLoading } = useProfile()

  if (!isAuthenticated) {
    // Where they were going is carried along, so signing in lands on the screen they asked for rather
    // than on whatever the default happens to be.
    return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    )
  }

  return <>{children}</>
}
