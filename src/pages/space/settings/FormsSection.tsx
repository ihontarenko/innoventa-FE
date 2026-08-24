import { useState } from "react"
import { Button, Input } from "@jmouse/ui"
import { useAddSpaceForm, useAvailableSpaceForms, useRemoveSpaceForm, useSpaceForms } from "@/hooks/useSpaceSettings"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * Which forms this workspace displays.
 *
 * Bound to the `forms` module through the registry, so a workspace that does not carry forms does not get
 * a form picker — which is what it used to get, because the page rendered this inline whatever the
 * workspace was.
 *
 * ⚠️ **The picker is part of the page** rather than a layer over it. It used to be a dropdown with a
 * scrollbar of its own inside a screen that already scrolls, and two scrollbars on one screen is one too
 * many.
 */
export function FormsSection({ space }: SpaceSettingsContext) {
  const { data: spaceForms = [] } = useSpaceForms(space.id)
  const { data: availableForms = [] } = useAvailableSpaceForms(space.id)

  const addForm = useAddSpaceForm()
  const removeForm = useRemoveSpaceForm()

  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState("")

  const matching = availableForms.filter((form) => form.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Section title="Forms" hint="Which forms this workspace displays">
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPicking(!picking)
            setSearch("")
          }}
        >
          {picking ? "Done adding" : "Add a form"}
        </Button>
      </div>

      {picking && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Input
            autoFocus
            className="h-8 text-sm"
            value={search}
            placeholder="Search forms…"
            onChange={(event) => setSearch(event.target.value)}
          />

          {matching.length === 0 ? (
            <p className="text-xs text-muted-foreground">No forms available.</p>
          ) : (
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {matching.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    addForm.mutate({ spaceId: space.id, formId: form.id })
                    setPicking(false)
                  }}
                >
                  <span className="truncate">
                    {form.icon && `${form.icon} `}
                    {form.name}
                  </span>
                  {form.category?.name && (
                    <span className="ml-auto text-[11px] text-muted-foreground">{form.category.name}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {spaceForms.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-8 text-center">
          <span className="text-sm font-medium">No forms yet</span>
          <span className="text-xs text-muted-foreground">Nothing has been assigned to this workspace.</span>
        </div>
      ) : (
        <div className="flex flex-col divide-y rounded-md border">
          {spaceForms.map((form) => (
            <div key={form.id} className="flex items-center gap-2 px-3 py-2">
              <span className="truncate text-sm">
                {form.icon && `${form.icon} `}
                {form.name}
              </span>
              {form.category?.name && <span className="text-[11px] text-muted-foreground">{form.category.name}</span>}

              {/* Words, not a cross — see the same note in the members section. */}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:bg-destructive/10"
                onClick={() => removeForm.mutate({ spaceId: space.id, formId: form.id })}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
