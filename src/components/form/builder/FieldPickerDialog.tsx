import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Skeleton } from "@jmouse/ui"
import { fieldTypeOf } from "@/lib/fieldTypes"
import { useEligibleFields } from "@/hooks/useForms"
import type { FieldSummary } from "@/types"

/**
 * Picking a field that already exists.
 *
 * ⚠️ **Fields are reusable, and that is the point of attaching rather than creating.** The same
 * "Manufacturer" appears on six forms and is one field — which is why this list is of things that
 * exist, and why what is already on the form is filtered out rather than shown as unavailable.
 */
export function FieldPickerDialog({
  open,
  title,
  excludedFieldIds,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  excludedFieldIds: string[]
  onPick: (field: FieldSummary) => void
  onClose: () => void
}) {
  const { data: eligible = [], isLoading } = useEligibleFields()
  const [search, setSearch] = useState("")

  const excluded = new Set(excludedFieldIds)
  const matches = eligible
    .filter((field) => !excluded.has(field.id))
    .filter((field) => {
      const needle = search.trim().toLowerCase()

      return !needle || field.label.toLowerCase().includes(needle) || field.name.toLowerCase().includes(needle)
    })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Fields are shared — attaching one here does not copy it.</DialogDescription>
        </DialogHeader>

        <Input autoFocus placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} />

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {isLoading && <Skeleton className="h-9 w-full" />}

          {!isLoading && matches.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nothing left to attach{search ? " under that search" : ""}.
            </p>
          )}

          {matches.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={() => onPick(field)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {field.icon ?? fieldTypeOf(field.elementType).glyph}
              </span>
              <span className="truncate">{field.label}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{field.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {fieldTypeOf(field.elementType).label}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
