import { useState, type ReactNode } from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@jmouse/ui"

/**
 * Choosing a record out of many — one, or several.
 *
 * ⚠️ **The same question a sourced field, a holder, a place and a workspace all ask**, which is why it
 * is one component rather than a picker per screen. What differs between them is where the records come
 * from; that belongs to the caller.
 *
 * ⚠️ **The search box appears only when the list is longer than one page.** A source that returns four
 * rows needs no typeahead, and one that returns fifty thousand cannot work without one — the widget
 * follows the data rather than being declared.
 */
export interface RecordOption {
  value: string
  label: string
  /**
   * The second line — a slug, an identifier, whatever tells two same-named records apart.
   *
   * ⚠️ **Optional, and its absence is what keeps the ordinary list one line tall.** A sourced choice
   * knows its own label and nothing else; a workspace has a name three others share.
   */
  hint?: string
}

export function RecordSelect({
  value,
  options,
  multiple = false,
  placeholder = "Select…",
  loading = false,
  disabled = false,
  search,
  onSearch,
  searchLabel = "Search…",
  empty = "Nothing to choose from.",
  footer,
  labelOf,
  onChange,
  onOpenChange,
}: {
  /** A single stored value, or the comma-joined list when `multiple`. */
  value: string | string[]
  options: RecordOption[]
  multiple?: boolean
  placeholder?: string
  loading?: boolean
  /** Read-only rather than hidden — what a policy names still has to be legible to somebody who may not edit it. */
  disabled?: boolean
  /** Present only when the caller wants a typeahead — its absence hides the box. */
  search?: string
  onSearch?: (query: string) => void
  searchLabel?: string
  empty?: ReactNode
  footer?: ReactNode
  /**
   * What a stored value reads as when it is not in the current page — a label learnt while picking, a
   * label the server resolved, or a tombstone.
   */
  labelOf: (storedValue: string) => string
  onChange: (value: string) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [isOpen, setOpen] = useState(false)
  const selected = multiple ? (value as string[]) : value ? [value as string] : []

  function toggle(optionValue: string) {
    if (!multiple) {
      onChange(optionValue)
      setOpen(false)
      onOpenChange?.(false)
      return
    }

    const next = selected.includes(optionValue)
      ? selected.filter((candidate) => candidate !== optionValue)
      : [...selected, optionValue]

    onChange(next.join(","))
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="w-full justify-start font-normal">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : multiple ? (
            <span className="flex flex-wrap gap-1">
              {selected.map((stored) => (
                <span key={stored} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {labelOf(stored)}
                </span>
              ))}
            </span>
          ) : (
            <span className="truncate">{labelOf(selected[0])}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        {onSearch && (
          <div className="border-b p-2">
            <Input
              autoFocus
              className="h-8 text-sm"
              placeholder={searchLabel}
              value={search ?? ""}
              onChange={(event) => onSearch(event.target.value)}
            />
          </div>
        )}

        <div className="max-h-64 overflow-y-auto p-1">
          {loading && options.length === 0 && (
            <span className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </span>
          )}

          {!loading && options.length === 0 && (
            <span className="block px-2 py-3 text-xs text-muted-foreground">{empty}</span>
          )}

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{option.label}</span>
                {option.hint && <span className="truncate text-[11px] text-muted-foreground">{option.hint}</span>}
              </span>
              {selected.includes(option.value) && <Check className="ml-auto size-3.5" />}
            </button>
          ))}
        </div>

        {footer && <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">{footer}</div>}

        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => onChange("")}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
