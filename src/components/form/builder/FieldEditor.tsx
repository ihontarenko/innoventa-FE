import { useEffect } from "react"
import { Button, Skeleton, cn } from "@jmouse/ui"
import type { FieldCondition, FormDetail } from "@/types"
import { HAS_OPTIONS } from "@/lib/fieldTypes"
import { useField } from "@/hooks/useForms"
import { AdvancedSection } from "./sections/AdvancedSection"
import { BasicsSection } from "./sections/BasicsSection"
import { ChoicesSection } from "./sections/ChoicesSection"
import { CompositionSection } from "./sections/CompositionSection"
import { ConditionSection } from "./sections/ConditionSection"
import { ValidationSection } from "./sections/ValidationSection"
import { useFieldDraft } from "./useFieldDraft"

/**
 * One field, in full — sections rather than tabs, and a footer that is always in reach.
 *
 * ⚠️ **A section that does not apply is not rendered.** That is what makes this shorter than the five
 * permanent tabs it replaces: a `TEXT` field has no *Choices* and no *Composition*, so it is Basics,
 * Condition, Validation, Advanced — four headings, three of them one line tall.
 *
 * ⚠️ **`form` is optional, and exactly ONE section depends on it.** The field catalogue edits a field
 * that belongs to no form, and everything a field owns — its label, its type, its choices, its children,
 * its validation, its attributes — is editable there. A **condition** is the one thing that is not: it
 * names sibling fields, and a field on its own has no siblings. So the section is absent rather than
 * disabled, because a disabled control is a promise that something could be filled in here.
 *
 * ⚠️ **Composition is NOT form-relative, which is easy to assume and wrong.** A composite's children are
 * the field's own — `CompositionSection` never took a form and `FieldPickerDialog` does not either — so
 * a group is fully editable from the catalogue too.
 *
 * ⚠️ **One editor, never two.** A second, simpler field editor for the catalogue would be a second place
 * validation can drift, and the one that drifts is always the one used less.
 */
export function FieldEditor({
  form,
  fieldId,
  condition = null,
  onPickChild,
}: {
  /** The form being built, when there is one. Absent from the catalogue — see above. */
  form?: FormDetail
  fieldId: string
  condition?: FieldCondition | null
  onPickChild: () => void
}) {
  const { data: detail, isLoading } = useField(fieldId)

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return <LoadedFieldEditor key={detail.id} form={form} detail={detail} condition={condition} onPickChild={onPickChild} />
}

function LoadedFieldEditor({
  form,
  detail,
  condition,
  onPickChild,
}: {
  form?: FormDetail
  detail: NonNullable<ReturnType<typeof useField>["data"]>
  condition: FieldCondition | null
  onPickChild: () => void
}) {
  const editor = useFieldDraft(detail)
  const { draft, isDirty, isSaving, error, revert, save, dirtySurfaces } = editor

  const isGroup = draft.usageType === "VIRTUAL" || draft.elementType === "COMPLEX_COMPOSITE"

  // ⌘S / Ctrl+S saves. ⚠️ Bound while this editor is mounted rather than globally, so it cannot fire
  // for a field nobody is looking at any more.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save])

  // ⚠️ The browser's own "leave this page?" prompt, and only while something is unsaved. A router-level
  // guard would also have to know about every way out of the screen; this one covers the tab closing,
  // which is the way work is actually lost.
  useEffect(() => {
    if (!isDirty) {
      return
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener("beforeunload", onBeforeUnload)

    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline gap-2 border-b px-4 py-2.5">
        <span aria-hidden="true">{draft.icon}</span>
        <h2 className="truncate text-sm font-semibold">{draft.label || "Untitled field"}</h2>
        <span className="truncate font-mono text-xs text-muted-foreground">{editor.derivedName}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <BasicsSection editor={editor} />
        {HAS_OPTIONS.has(draft.elementType) && <ChoicesSection editor={editor} />}
        {isGroup && <CompositionSection field={detail} onPickChild={onPickChild} />}
        {/* ⚠️ Absent without a form, not disabled: a condition names sibling fields, and a field in the
            catalogue has none. See the note on `FieldEditor`. */}
        {form && <ConditionSection form={form} field={detail} condition={condition} />}
        <ValidationSection editor={editor} />
        <AdvancedSection editor={editor} />
      </div>

      <footer className="flex items-center gap-2 border-t bg-background px-4 py-2.5">
        <span className={cn("flex items-center gap-1.5 text-xs", isDirty ? "text-foreground" : "text-muted-foreground")}>
          <span className={cn("size-1.5 rounded-full", isDirty ? "bg-warning" : "bg-transparent")} />
          {isDirty ? `unsaved · ${[...dirtySurfaces].join(", ")}` : "saved"}
        </span>

        {error && <span className="truncate text-xs text-destructive">{error}</span>}

        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={!isDirty || isSaving} onClick={revert}>
            Revert
          </Button>
          <Button type="button" size="sm" disabled={!isDirty || isSaving} onClick={() => void save()}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </footer>
    </div>
  )
}
