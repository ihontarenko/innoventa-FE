import { useState }                                                                      from "react"
import { Link, useParams }                                                               from "react-router-dom"
import { ExternalLink, Eye, ShieldCheck, SlidersHorizontal }                             from "lucide-react"
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@jmouse/ui"
import type { FieldSummary, FormDetail }                                                 from "@/types"
import { PageHeader }                                                                    from "@/components/PageHeader"
import {
    FormManagementDialog
}                                                                                        from "@/components/form/FormManagementDialog"
import {
    FormPreviewDialog
}                                                                                        from "@/components/form/FormPreviewDialog"
import {
    FormValidationDialog
}                                                                                        from "@/components/form/FormValidationDialog"
import { spaceSectionPath }                                                              from "@/lib/navigationContext"
import { useAttachField }                                                                from "@/hooks/useForms"
import { useIsWideLayout }                                                               from "@/hooks/useMediaQuery"
import { ChildPickerDialog }                                                             from "./ChildPickerDialog"
import { FieldEditor }                                                                   from "./FieldEditor"
import { FieldPickerDialog }                                                             from "./FieldPickerDialog"
import { FormCanvas }                                                                    from "./FormCanvas"

/**
 * Building a form: the questions it asks, in order, each opening where it stands.
 *
 * ⚠️ **An ordinary screen now, with the ordinary `PageHeader`** (Ivan, 2026-08-25: *«лейаут не в
 * загальному стилі»*). It used to be a workbench in a bordered box with a header of its own invention,
 * so the one screen somebody spends the most time in was the one screen that looked like nowhere else in
 * the product — and the same view rendered inside other content sat visibly at the wrong altitude.
 *
 * ⚠️ **No preview pane** (Ivan, 2026-08-25: *«превью теж просив прибрати і зробити кнопку»*). It is a
 * button, and the window it opens is the same `DynamicForm` the pane drew. The column it was taking is
 * the column the questions now have.
 *
 * ⚠️ **Settings opens the management screen, not a sheet of its own.** There is one place a form's
 * name, reach, placement, widgets and configuration are edited, and the builder opens it at the **base**
 * level — see `ManagementDepth` for why the deepest screen is not the deepest level.
 *
 * ⚠️ **Narrow screens get the field editor as a sheet, not a squeezed card.** Two cards side by side
 * need a screen; one component either way, because a phone-shaped copy of a field editor is a
 * phone-shaped copy of every bug in it.
 */
export function FormBuilder({ form }: { form: FormDetail }) {
  const { spaceSlug } = useParams()
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [isAttaching, setAttaching] = useState(false)
  const [isPickingChild, setPickingChild] = useState(false)
  const [isPreviewOpen, setPreviewOpen] = useState(false)
  const [isManaging, setManaging] = useState(false)
  const [isValidating, setValidating] = useState(false)
  const isWide = useIsWideLayout()

  const attachField = useAttachField(form.id)

  async function onAttach(field: FieldSummary) {
    await attachField.mutateAsync(field.id)
    setSelectedFieldId(field.id)
    setAttaching(false)
  }

  function conditionOf(fieldId: string) {
    return form.fieldConditions?.[fieldId] ?? null
  }

  /** The field's own address — a link out of the builder, and the only door on a phone. */
  function fieldPath(fieldId: string) {
    return spaceSectionPath(spaceSlug ?? "", `fields/${fieldId}`)
  }

  return (
    <>
      <PageHeader
        title={`${form.icon ?? "▤"} ${form.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {form.codename && <span className="font-mono">{form.codename}</span>}
            {form.purpose && <Badge variant="secondary">{form.purpose.label}</Badge>}
            {form.category && <Badge variant="outline">{form.category.name}</Badge>}
            <span>the questions it asks, and the order it asks them in</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-3.5" />
              Preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setValidating(true)}>
              <ShieldCheck className="size-3.5" />
              Validation
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setManaging(true)}>
              <SlidersHorizontal className="size-3.5" />
              Settings
            </Button>
          </>
        }
      />

      <FormCanvas
        form={form}
        expandedFieldId={isWide ? selectedFieldId : null}
        onExpand={setSelectedFieldId}
        onAttach={() => setAttaching(true)}
        renderEditor={(field) => (
          <FieldEditor
            form={form}
            fieldId={field.id}
            condition={conditionOf(field.id)}
            variant="inline"
            onPickChild={() => setPickingChild(true)}
            onClose={() => setSelectedFieldId(null)}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to={fieldPath(field.id)}>
                  <ExternalLink className="size-3.5" />
                  Open as a page
                </Link>
              </Button>
            }
          />
        )}
      />

      {/* ⚠️ Below `lg` only. The same editor, and the same draft rules — see the note on the component. */}
      <Sheet open={!!selectedFieldId && !isWide} onOpenChange={(next) => !next && setSelectedFieldId(null)}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Edit field</SheetTitle>
            <SheetDescription>The same editor a wide screen opens inside the row.</SheetDescription>
          </SheetHeader>
          {selectedFieldId && (
            <FieldEditor
              form={form}
              fieldId={selectedFieldId}
              condition={conditionOf(selectedFieldId)}
              variant="panel"
              onPickChild={() => setPickingChild(true)}
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link to={fieldPath(selectedFieldId)}>
                    <ExternalLink className="size-3.5" />
                    Page
                  </Link>
                </Button>
              }
            />
          )}
        </SheetContent>
      </Sheet>

      <FieldPickerDialog
        open={isAttaching}
        title="Attach a field"
        excludedFieldIds={form.fields.map((field) => field.id)}
        onPick={onAttach}
        onClose={() => setAttaching(false)}
      />

      <ChildPickerDialog fieldId={selectedFieldId} open={isPickingChild} onClose={() => setPickingChild(false)} />

      {isPreviewOpen && <FormPreviewDialog formId={form.id} onClose={() => setPreviewOpen(false)} />}

      {/* ⚠️ **`base`, and this is the levels rule, not an oversight** (Ivan, 2026-08-25). The builder is
          reached from the form library, which is the platform's base and knows nothing about stock or
          distributors — so no subject-area configuration appears here however much detail is to hand.
          `stock.*` and `catalogue.*` are edited on Component types, the level that owns them. */}
      {isManaging && <FormManagementDialog form={form} onClose={() => setManaging(false)} />}

      {/* ⚠️ The document is about the FORM, so it is edited from the form and nowhere else. A field's
          own rules travel with the field — `quantity` carries one for forty-four forms — and this
          window deliberately cannot reach them. */}
      <FormValidationDialog form={form} open={isValidating} onOpenChange={setValidating} />
    </>
  )
}
