import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label, Skeleton } from "@jmouse/ui"
import { UnreadableValueNotice, ValueReadings } from "@/components/features/ValueReadings"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { READING_DEBOUNCE_MILLISECONDS, useValueReadings } from "@/hooks/useParametric"
import type { ValueReading } from "@/api/parametric"

/**
 * Every form a written value takes, and a way back into the search.
 *
 * ⚠️ **A marking can mean more than one part.** `332` is a number, and also a resistor code, a capacitor
 * code and an inductor code — so this lists every *reading*, each with every way its value is written.
 * That is the whole reason the dialog exists: the search field can only act on one interpretation at a
 * time, and choosing between them is a different question from filtering by one.
 *
 * ⚠️ **Prefilled from the RAW text, never the normalised value.** `3k3` opens as `3k3`: filling in
 * `3300` would drop the very spelling somebody started from, which is the one they opened this to
 * compare against the others.
 *
 * ⚠️ **It asks the same `/readings` query the page behind it already asked**, so opening it straight
 * after typing costs no request — React Query answers both from one cached entry.
 */
export function ValueFormsDialog({
  initialValue,
  onClose,
  onSearchReading,
}: {
  initialValue: string
  onClose: () => void
  /** Closes the dialog and takes the search over to this reading — offered once per reading. */
  onSearchReading: (reading: ValueReading) => void
}) {
  const [value, setValue] = useState(initialValue)

  const typed = value.trim()
  const settled = useDebouncedValue(typed, READING_DEBOUNCE_MILLISECONDS)

  const { data: readings, isFetching } = useValueReadings(settled, settled.length > 0)

  const isUnreadable = settled.length > 0 && readings !== undefined && readings.length === 0

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      {/* ⚠️ **Bounded, and the BODY is what scrolls.** A reading carries every spelling plus seven
          E-series grids, and `332` produces two readings — so this grows past any screen. Left
          unbounded the dialog centred itself on content taller than the viewport and put its own title
          and its input off the top edge, which is the half somebody needs to keep typing in.

          ⚠️ `max-h` belongs here and `overflow-y-auto` on the inner block, never both on one element:
          capping the height without giving the overflow somewhere to go clips silently instead of
          scrolling. */}
      <DialogContent className="flex max-h-[85svh] flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Value forms</DialogTitle>
          <DialogDescription className="text-xs">
            A marking can mean more than one part — <code className="font-mono">332</code> is a number, and
            also a resistor, a capacitor and an inductor code. Each reading is listed with every way its
            value is written.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-2">
          <Label htmlFor="value-forms">Value</Label>
          <Input
            id="value-forms"
            autoFocus
            value={value}
            placeholder="e.g. 3.3kOhm, 10nF, 0.1MOhm, 332"
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isFetching && <Skeleton className="h-20 w-full" />}
          {isUnreadable && <UnreadableValueNotice value={settled} />}
          {readings && !isFetching && (
            <ValueReadings
              readings={readings}
              onSearchReading={(reading) => {
                onSearchReading(reading)
                onClose()
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
