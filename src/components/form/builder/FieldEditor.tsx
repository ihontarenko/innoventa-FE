import { useEffect, type ReactNode } from "react"
import { Button, Input, Skeleton, Switch, cn } from "@jmouse/ui"
import type { FieldCondition, FormDetail } from "@/types"
import { HAS_OPTIONS } from "@/lib/fieldTypes"
import { useField } from "@/hooks/useForms"
import { AdvancedSection } from "./sections/AdvancedSection"
import { ChoicesSection } from "./sections/ChoicesSection"
import { CompositionSection } from "./sections/CompositionSection"
import { ConditionSection } from "./sections/ConditionSection"
import { ShapeSection } from "./sections/ShapeSection"
import { ValidationSection } from "./sections/ValidationSection"
import { FieldPreviewCard } from "./FieldPreviewCard"
import { useFieldDraft } from "./useFieldDraft"

/**
 * Where the editor is standing, which is the only thing that differs between its three homes.
 *
 * | Variant | Where | Shape |
 * |---|---|---|
 * | `inline` | expanded inside a row, in the builder and in the catalogue | cards tiled two-up, footer sticks to the bottom |
 * | `panel` | the sheet a narrow screen gets | one column, its own scroller |
 * | `page` | the field's own address | cards tiled two-up, no scroller of its own — the page scrolls |
 */
export type FieldEditorVariant = "inline" | "panel" | "page"

/**
 * One field, in full — cards rather than tabs, and a preview of the real control beside them.
 *
 * ⚠️ **A card that does not apply is not rendered.** A `TEXT` field has no *Choices* and no
 * *Composition*, so it is Preview, Shape, Condition, Validation, Advanced — and on a wide screen every
 * one of them is on the screen at once. That is what makes this shorter than the five permanent tabs it
 * replaced, and what makes editing in place worth doing at all.
 *
 * ⚠️ **`form` is optional, and exactly ONE card depends on it.** The field catalogue edits a field that
 * belongs to no form, and everything a field owns — its label, its type, its choices, its children, its
 * validation, its attributes — is editable there. A **condition** is the one thing that is not: it names
 * sibling fields, and a field on its own has no siblings. So the card is absent rather than disabled,
 * because a disabled control is a promise that something could be filled in here.
 *
 * ⚠️ **Composition is NOT form-relative, which is easy to assume and wrong.** A composite's children are
 * the field's own — `CompositionSection` never took a form and `FieldPickerDialog` does not either — so
 * a group is fully editable from the catalogue too.
 *
 * ⚠️ **One editor, never two.** A second, simpler field editor for the catalogue would be a second place
 * validation can drift, and the one that drifts is always the one used less. That is also why the three
 * variants above are a paint decision and nothing more — no variant may own a control the others lack.
 */
export function FieldEditor({
  form,
  fieldId,
  condition = null,
  variant = "panel",
  actions,
  onPickChild,
  onClose,
}: {
  /** The form being built, when there is one. Absent from the catalogue — see above. */
  form?: FormDetail
  fieldId: string
  condition?: FieldCondition | null
  variant?: FieldEditorVariant
  /** Extra controls for the footer — "open as a page", "close". */
  actions?: ReactNode
  onPickChild: () => void
  /** Collapses the editor. Bound to Escape for the inline variant, where nothing else would close it. */
  onClose?: () => void
}) {
  const { data: detail, isLoading } = useField(fieldId)

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  return (
    <LoadedFieldEditor
      key={detail.id}
      form={form}
      detail={detail}
      condition={condition}
      variant={variant}
      actions={actions}
      onPickChild={onPickChild}
      onClose={onClose}
    />
  )
}

function LoadedFieldEditor({
  form,
  detail,
  condition,
  variant,
  actions,
  onPickChild,
  onClose,
}: {
  form?: FormDetail
  detail: NonNullable<ReturnType<typeof useField>["data"]>
  condition: FieldCondition | null
  variant: FieldEditorVariant
  actions?: ReactNode
  onPickChild: () => void
  onClose?: () => void
}) {
  const editor = useFieldDraft(detail)
  const { draft, update, isDirty, isSaving, error, revert, save, dirtySurfaces } = editor

  const isGroup = draft.usageType === "VIRTUAL" || draft.elementType === "COMPLEX_COMPOSITE"
  const isTiled = variant !== "panel"

  // ⌘S / Ctrl+S saves, Escape collapses. ⚠️ Bound while this editor is mounted rather than globally, so
  // neither can fire for a field nobody is looking at any more — and Escape only for the inline variant,
  // because a sheet and a page each already have a way out that would otherwise act on it twice.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
      }

      if (event.key === "Escape" && variant === "inline" && onClose && !isDirty) {
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save, variant, onClose, isDirty])

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
      {/* ⚠️ **The identity strip is not a card and never collapses.** A field's glyph, its name and
          whether it must be answered are what somebody is reading in every one of the cards below —
          putting them behind a heading of their own was the one thing every visit had to open first. */}
      {/* ⚠️ `pr-10` in the sheet, and only there: its own close button is positioned over this corner,
          and without the inset it lands on top of the Required switch. */}
      <div className={cn("flex flex-col gap-2 border-b bg-muted/30 px-3 py-2.5", variant === "panel" && "pr-10")}>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Icon"
            className="size-9 shrink-0 p-0 text-center text-base"
            maxLength={4}
            placeholder="◇"
            value={draft.icon}
            onChange={(event) => update({ icon: event.target.value })}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <Input
              aria-label="Label"
              className="h-7 border-0 bg-transparent px-1 font-display text-base font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent"
              placeholder="Untitled field"
              value={draft.label}
              onChange={(event) => update({ label: event.target.value })}
            />
            {/* ⚠️ Derived and read-only. It is what every stored answer is keyed by, so renaming it
                would orphan the data rather than rename it. */}
            <span
              className="truncate px-1 font-mono text-[11px] text-muted-foreground"
              title="Derived from the label — every stored answer is keyed by it"
            >
              {editor.derivedName}
            </span>
          </div>

          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs">
            <Switch checked={draft.required} onCheckedChange={(required) => update({ required })} />
            <span>Required</span>
          </label>
        </div>

        <Input
          aria-label="Description"
          className="h-8 text-xs"
          placeholder="The line under the control on the form — what this field is for"
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </div>

      <div className={cn("min-h-0", variant === "panel" && "flex-1 overflow-y-auto")}>
        <div className={cn("grid items-start gap-3 p-3", isTiled && "md:grid-cols-2")}>
          <FieldPreviewCard detail={detail} draft={draft} />

          <ShapeSection editor={editor} />

          {HAS_OPTIONS.has(draft.elementType) && (
            <div className={cn(isTiled && "md:col-span-2")}>
              <ChoicesSection editor={editor} />
            </div>
          )}

          {isGroup && (
            <div className={cn(isTiled && "md:col-span-2")}>
              <CompositionSection field={detail} onPickChild={onPickChild} />
            </div>
          )}

          {/* ⚠️ Absent without a form, not disabled: a condition names sibling fields, and a field in
              the catalogue has none. See the note on `FieldEditor`. */}
          {form && <ConditionSection form={form} field={detail} condition={condition} />}

          {/* ⚠️ Validation takes the whole row when there is no condition beside it — a lone half-width
              card with an empty column next to it reads as something that failed to load. */}
          <div className={cn(isTiled && !form && "md:col-span-2")}>
            <ValidationSection editor={editor} />
          </div>

          <div className={cn(isTiled && "md:col-span-2")}>
            <AdvancedSection editor={editor} fieldId={detail.id} />
          </div>
        </div>
      </div>

      <footer
        className={cn(
          "flex flex-wrap items-center gap-2 border-t bg-background/95 px-3 py-2 backdrop-blur",
          variant !== "page" && "sticky bottom-0 z-10",
        )}
      >
        {/* ⚠️ WHICH surface is unsaved, not merely that something is. Saving writes each of the five
            separately, so "unsaved · options" is the difference between knowing what a failed save
            would have touched and guessing. */}
        <span className={cn("flex items-center gap-1.5 text-xs", isDirty ? "text-foreground" : "text-muted-foreground")}>
          <span className={cn("size-1.5 rounded-full", isDirty ? "animate-pulse bg-warning" : "bg-transparent")} />
          {isDirty ? "unsaved" : "saved"}
        </span>

        {isDirty &&
          [...dirtySurfaces].map((surface) => (
            <span
              key={surface}
              className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] leading-none"
            >
              {surface}
            </span>
          ))}

        {error && <span className="truncate text-xs text-destructive">{error}</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {actions}
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
