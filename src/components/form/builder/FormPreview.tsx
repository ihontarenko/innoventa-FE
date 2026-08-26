import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@jmouse/ui"
import type { FormDetail } from "@/types"
import { DynamicForm } from "../DynamicForm"

/**
 * The form as the person filling it in will meet it.
 *
 * ⚠️ **The real `DynamicForm`, not a mock of one.** A preview drawn by a second renderer is a preview
 * of something that does not exist: conditions, phantom inference and the cascade that clears hidden
 * answers are exactly what somebody wants to try, and they only behave correctly in the thing that
 * implements them.
 *
 * ⚠️ **Nothing here is ever submitted.** The scratch values live in this component and go nowhere —
 * the whole point is to poke at a form that has no entries yet.
 *
 * ⚠️ **`withHeader` is off in the window, and Clear moves rather than disappearing.** `FormPreviewDialog`
 * carries the form's name in its own title bar, so this component's heading would be the second one; the
 * button that empties the scratch values is not decoration and follows the fields instead.
 */
export function FormPreview({ form, withHeader = true }: { form: FormDetail; withHeader?: boolean }) {
  const [scratchKey, setScratchKey] = useState(0)

  function clear() {
    setScratchKey((previous) => previous + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {withHeader && (
        <header className="flex items-center gap-2 border-b px-4 py-2.5">
          <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Preview</h2>
          <span className="text-xs text-muted-foreground">nothing typed here is saved</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            aria-label="Clear the preview"
            onClick={clear}
          >
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {form.fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">Attach a field and it appears here.</p>
        ) : (
          <DynamicForm
            // Remounts on Clear — the values live inside the form, which is what keeps this component
            // free of a second copy of them.
            key={scratchKey}
            form={form}
            hideSubmitButton
            onSubmit={async () => undefined}
          />
        )}
      </div>

      {!withHeader && (
        <footer className="flex shrink-0 items-center gap-2 border-t px-4 py-2">
          <span className="text-xs text-muted-foreground">Nothing typed here is saved.</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={clear}>
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
        </footer>
      )}
    </div>
  )
}
