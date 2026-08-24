import { useState } from "react"
import { Pin, PinOff, X } from "lucide-react"
import { toast } from "sonner"
import { Button, Input } from "@jmouse/ui"
import { ToggleChip } from "@/components/ToggleChip"
import { useForgetView, usePinView, useSaveView, useSavedViews } from "@/hooks/useSavedViews"

/**
 * The questions this person asks often enough to have named.
 *
 * <p>One row above a board: the saved views as chips, and — once a filter is actually on — the offer to
 * name the one currently applied.
 *
 * ⚠️ **The filter is the caller's own object, and this component never looks inside it.** It serialises
 * what it is handed and hands back what it stored. A board gaining a chip therefore costs a line in that
 * board rather than a change here, on the backend, and in a migration.
 *
 * ⚠️ **`isFiltered` is the caller's answer too.** Only the screen knows whether its own filter is at
 * rest: an empty object on one board and `state: undefined` on another mean the same thing, and a
 * component guessing would offer to save "everything" as a view.
 *
 * ⚠️ **Nothing is applied until somebody clicks.** A board that restored the last view on mount would
 * take away the one thing a filter row must have — the ability to open a screen and see all of it.
 */
export function ViewBar<Filter>({
  section,
  filter,
  isFiltered,
  activeViewId,
  onApply,
}: {
  section: string
  filter: Filter
  /** Whether the filter currently on the screen is worth naming. */
  isFiltered: boolean
  /** Which view the screen considers applied, so the chip can show it. */
  activeViewId: string | null
  onApply: (filter: Filter, viewId: string | null) => void
}) {
  const { data: views = [] } = useSavedViews(section)

  const save = useSaveView()
  const pin = usePinView()
  const forget = useForgetView()

  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")

  function apply(view: (typeof views)[number]) {
    try {
      onApply(JSON.parse(view.filter) as Filter, view.id)
    } catch {
      // ⚠️ A view whose stored filter no longer parses is a real state, not a crash: the shape it was
      // saved under can change. Saying so beats applying nothing and leaving a board that looks
      // unfiltered while a chip claims otherwise.
      toast.error(`"${view.name}" was saved in a shape this screen no longer understands.`)
    }
  }

  if (views.length === 0 && !isFiltered) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((view) => (
        <span key={view.id} className="group flex items-center">
          <ToggleChip active={activeViewId === view.id} onClick={() => apply(view)}>
            {view.pinned && <Pin className="mr-1 inline size-3" aria-hidden="true" />}
            {view.name}
          </ToggleChip>

          {/* Shown on hover rather than always: eight views each carrying two permanent buttons is a
              toolbar, and this row is meant to disappear into the screen. */}
          <span className="ml-0.5 flex opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title={view.pinned ? "Take it out of the menu" : "Put it in the menu"}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => pin.mutate({ viewId: view.id, pinned: !view.pinned })}
            >
              {view.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
            </button>
            <button
              type="button"
              title="Forget this view"
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              onClick={() => {
                forget.mutate(view.id)

                if (activeViewId === view.id) {
                  onApply({} as Filter, null)
                }
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        </span>
      ))}

      {isFiltered &&
        (naming ? (
          <span className="flex items-center gap-1">
            <Input
              autoFocus
              className="h-6 w-44 text-xs"
              placeholder="What is this view called?"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setNaming(false)
                }
              }}
            />
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={!name.trim() || save.isPending}
              onClick={() =>
                save.mutate(
                  { name: name.trim(), section, filter: JSON.stringify(filter) },
                  {
                    onSuccess: () => {
                      setName("")
                      setNaming(false)
                    },
                    onError: (error) => {
                      const detail = (error as { response?: { data?: { detail?: string } } })?.response
                        ?.data?.detail

                      toast.error(detail ?? "That view was not saved.")
                    },
                  },
                )
              }
            >
              Save
            </Button>
          </span>
        ) : (
          <button
            type="button"
            className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setNaming(true)}
          >
            + Save this view
          </button>
        ))}
    </div>
  )
}
