import { useState } from "react"
import { CircleHelp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@jmouse/ui"

/**
 * How long a hint may be before it stops being a hint.
 *
 * ⚠️ **A threshold rather than a rule for every hint, because the two kinds are genuinely different.**
 * "In millimetres" costs one short line and is worth more where the eye already is than behind a
 * click. Four lines about how a CAD tool spells a 3D model path is a rule somebody needs once, and it
 * pushes every field below it down the screen every time the form is opened afterwards.
 *
 * The number is a judgement, not a measurement: it is about two lines at the width a form control gets.
 */
const INLINE_LIMIT = 90

export function isLongHint(hint: string | null | undefined): boolean {
  return !!hint && hint.trim().length > INLINE_LIMIT
}

/**
 * The help a field carries, when it is too long to sit under the control.
 *
 * ⚠️ **Beside the LABEL, never under the control.** The line under a control belongs to the error, and
 * the two must never compete for it — a field that grew a second line the moment it was rejected is
 * what made a long form jump around while it was being corrected.
 *
 * ⚠️ **A button, not a tooltip.** The text this stands in for is prose with examples in it; a tooltip
 * that vanishes when the pointer leaves is unreadable at that length, and unreachable by touch at any
 * length.
 */
export function FieldHelp({ label, hint }: { label: string; hint: string }) {
  const [isOpen, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What to put in ${label}`}
        title={`What to put in ${label}`}
        className="text-muted-foreground hover:text-foreground -my-1 rounded-full p-1 transition-colors"
      >
        <CircleHelp className="size-3.5" />
      </button>

      {isOpen && (
        <Dialog open onOpenChange={(next) => !next && setOpen(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{label}</DialogTitle>
            </DialogHeader>

            {/* ⚠️ `whitespace-pre-line`: a hint is written in a settings textarea, so the line breaks
                somebody typed are part of what they wrote. Collapsed, a three-example hint becomes one
                unreadable paragraph. */}
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{hint}</p>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
