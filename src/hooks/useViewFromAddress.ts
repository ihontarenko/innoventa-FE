import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useSavedViews } from "@/hooks/useSavedViews"

/**
 * Applies the view named in the address, once.
 *
 * <p>A pinned view in the menu links to `…/maintenance?view=abc`. That is what makes it a real menu
 * item rather than a shortcut: the link is shareable, it survives a reload, and Back goes where somebody
 * expects. This is the board's half of that.
 *
 * ⚠️ **Once, and tracked by a ref rather than by the query key.** The board's own state changes the
 * moment the filter is applied, and an effect that re-ran on every render would fight anybody who then
 * narrowed by hand — reapplying the view under their fingers.
 *
 * ⚠️ **A view that no longer exists says so and clears the address.** Leaving `?view=` pointing at a
 * deleted row would make an unfiltered board look like a filtered one for ever, which is the failure
 * where a screen quietly answers a different question than it claims.
 */
export function useViewFromAddress<Filter>(
  section: string,
  onApply: (filter: Filter, viewId: string | null) => void,
) {
  const [parameters, setParameters] = useSearchParams()
  const { data: views, isLoading } = useSavedViews(section)

  const wanted = parameters.get("view")
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!wanted || isLoading || !views || applied.current === wanted) {
      return
    }

    applied.current = wanted

    const view = views.find((candidate) => candidate.id === wanted)

    if (!view) {
      toast.error("That view is gone.")
      setParameters({}, { replace: true })

      return
    }

    try {
      onApply(JSON.parse(view.filter) as Filter, view.id)
    } catch {
      toast.error(`"${view.name}" was saved in a shape this screen no longer understands.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, isLoading, views])
}
