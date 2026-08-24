import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, Settings2 } from "lucide-react"
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, cn } from "@jmouse/ui"
import type { FieldSummary, FormDetail } from "@/types"
import { fieldsApi } from "@/api/fields"
import { useAttachField, useField } from "@/hooks/useForms"
import { useIsWideLayout } from "@/hooks/useMediaQuery"
import { FieldEditor } from "./FieldEditor"
import { FieldPickerDialog } from "./FieldPickerDialog"
import { FormPreview } from "./FormPreview"
import { FormSettingsSheet } from "./FormSettingsSheet"
import { SchemaList } from "./SchemaList"

/**
 * Building a form: the schema on the left, one field on the right, and the form itself beside them.
 *
 * ⚠️ **Two panes rather than a list that swells.** The old builder expanded the row you were reading
 * into a five-tab panel, so the list you were navigating by moved under you every time you opened
 * something. Nothing in the left column ever changes height here.
 *
 * ⚠️ **Narrow screens get the same editor as a sheet**, not a second layout. One component, one set of
 * behaviours; a phone-shaped copy of a field editor is a phone-shaped copy of every bug in it.
 */
export function FormBuilder({ form }: { form: FormDetail }) {
  const queryClient = useQueryClient()
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(form.fields[0]?.id ?? null)
  const [isAttaching, setAttaching] = useState(false)
  const [isPickingChild, setPickingChild] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const isWide = useIsWideLayout()

  const attachField = useAttachField(form.id)
  const { data: selectedDetail } = useField(selectedFieldId ?? undefined)

  const addChild = useMutation({
    mutationFn: (childFieldId: string) => fieldsApi.addChild(selectedFieldId!, childFieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields", selectedFieldId] })
      queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })

  async function onAttach(field: FieldSummary) {
    await attachField.mutateAsync(field.id)
    setSelectedFieldId(field.id)
    setAttaching(false)
  }

  const condition = selectedFieldId ? (form.fieldConditions?.[selectedFieldId] ?? null) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <h1 className="truncate text-sm font-semibold">
          {form.icon && <span className="mr-1.5">{form.icon}</span>}
          {form.name}
        </h1>
        {form.codename && <span className="truncate font-mono text-xs text-muted-foreground">{form.codename}</span>}

        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((previous) => !previous)}>
            {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            Preview
          </Button>
          {/* The form's own settings are read rarely and edited rarely — a sheet, not a third column
              competing for width with the work (Ivan, 2026-08-19). */}
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            <Settings2 className="size-3.5" />
            Settings
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <div className="min-h-0 border-r">
          <SchemaList
            form={form}
            selectedFieldId={selectedFieldId}
            onSelect={setSelectedFieldId}
            onAttach={() => setAttaching(true)}
          />
        </div>

        {/* Below `lg` the editor is a sheet instead — see the same component rendered twice below. */}
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          {selectedFieldId ? (
            <FieldEditor
              form={form}
              fieldId={selectedFieldId}
              condition={condition}
              onPickChild={() => setPickingChild(true)}
            />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Pick a field on the left, or attach one.</p>
          )}
        </div>

        <div className={cn("min-h-0 border-l", showPreview ? "hidden xl:flex xl:flex-col" : "hidden")}>
          <FormPreview form={form} />
        </div>
      </div>

      <Sheet
        open={!!selectedFieldId && !isWide}
        onOpenChange={(next) => !next && setSelectedFieldId(null)}
      >
        <SheetContent side="right" className="flex w-full max-w-md flex-col p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Edit field</SheetTitle>
            <SheetDescription>The same editor the wide layout shows beside the list.</SheetDescription>
          </SheetHeader>
          {selectedFieldId && (
            <FieldEditor
              form={form}
              fieldId={selectedFieldId}
              condition={condition}
              onPickChild={() => setPickingChild(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      <FormSettingsSheet form={form} open={showSettings} onClose={() => setShowSettings(false)} />

      <FieldPickerDialog
        open={isAttaching}
        title="Attach a field"
        excludedFieldIds={form.fields.map((field) => field.id)}
        onPick={onAttach}
        onClose={() => setAttaching(false)}
      />

      <FieldPickerDialog
        open={isPickingChild}
        title="Add a child field"
        excludedFieldIds={[
          ...(selectedDetail?.children ?? []).map((child) => child.id),
          ...(selectedFieldId ? [selectedFieldId] : []),
        ]}
        onPick={async (field) => {
          await addChild.mutateAsync(field.id)
          setPickingChild(false)
        }}
        onClose={() => setPickingChild(false)}
      />
    </div>
  )
}
