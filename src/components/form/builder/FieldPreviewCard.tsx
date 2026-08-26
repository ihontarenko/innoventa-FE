import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@jmouse/ui"
import type { FieldDetail } from "@/types"
import { FieldRow } from "../FieldRow"
import { EditorSection } from "./EditorSection"
import type { FieldDraft } from "./useFieldDraft"

/**
 * The field as the form will ask it — live, from the draft, before anything is saved.
 *
 * ⚠️ **`FieldRow` over `FieldControl`, and the same one the form itself draws.** A preview built out of
 * its own markup is a second renderer, and a second renderer is a preview that is wrong exactly when it
 * matters — the day a control changes. This one is the real row: real label, real required mark, real
 * hint line under it, real control.
 *
 * ⚠️ **It is fillable, deliberately.** Picking `Quantity` and being unable to try the unit picker teaches
 * nothing that reading the word "Quantity" did not. The value goes nowhere — there is no entry here.
 *
 * ⚠️ **The stored spelling is shown beside it**, because it is the half nobody can guess: `4.7|kΩ` for a
 * quantity, `SMD|LQFP|64` for a multi-segment, a comma-joined list for a multi-select. That is what an
 * expression is written against and what a search matches, and until now it was only discoverable by
 * saving an entry and reading the database.
 */
export function FieldPreviewCard({ detail, draft }: { detail: FieldDetail; draft: FieldDraft }) {
  const [value, setValue] = useState("")

  return (
    <EditorSection
      title="Preview"
      icon="◉"
      hint="live — nothing is stored"
      className="border-primary/30 bg-gradient-to-b from-primary/5 to-transparent"
    >
      <div className="rounded-md border bg-background p-3">
        <FieldRow
          field={previewFieldOf(detail, draft)}
          value={value}
          onChange={setValue}
          required={draft.required}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">stored as</span>
        <code className="min-w-0 flex-1 truncate rounded bg-muted/60 px-1.5 py-1 font-mono text-[11px]">
          {value || <span className="text-muted-foreground">— nothing yet —</span>}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          aria-label="Clear the preview"
          disabled={!value}
          onClick={() => setValue("")}
        >
          <RotateCcw className="size-3" />
        </Button>
      </div>
    </EditorSection>
  )
}

/**
 * The draft, shaped as the field it is describing.
 *
 * ⚠️ **Everything the draft owns overrides the saved field, and everything else is kept.** The children
 * of a group and the field's id are not part of the draft — a composite would render as an empty row
 * without them, and the id is what a provider-backed choice list is fetched by.
 */
function previewFieldOf(detail: FieldDetail, draft: FieldDraft): FieldDetail {
  return {
    ...detail,
    label: draft.label || "Untitled field",
    icon: draft.icon || null,
    description: draft.description || null,
    usageType: draft.usageType,
    elementType: draft.elementType,
    unit: draft.unit || null,
    required: draft.required,
    options: draft.options.map((option, index) => ({
      id: `preview-${index}`,
      optionValue: option.value,
      optionLabel: option.label || option.value,
      sortOrder: index,
    })),
    validationExpressions: draft.validation,
    attributes: draft.attributes,
    configs: draft.configs,
  }
}
