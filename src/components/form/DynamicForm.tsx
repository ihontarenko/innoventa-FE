import { useEffect, useState, type FormEvent, type RefObject } from "react"
import { Alert, AlertDescription, Button, cn } from "@jmouse/ui"
import type { FormDetail } from "@/types"
import { resolveRequired, resolveVisible, withInferredPhantoms } from "@/lib/formConditions"
import { hasNamedSections, sectionsOf, WIDTH_CLASS, widthOf } from "@/lib/formLayout"
import { fieldErrorsOf, withoutHiddenValues, withoutPhantomValues } from "@/lib/formValues"
import { FieldRow } from "./FieldRow"
import { VirtualFieldGroup } from "./VirtualFieldGroup"

interface DynamicFormProperties {
  form: FormDetail
  initialValues?: Record<string, string>
  /**
   * What the initial values of sourced fields read as: field name → stored value → label. Comes
   * straight off the entry being edited, so a reference shows a name rather than an identifier before
   * its picker has ever been opened.
   */
  optionLabels?: Record<string, Record<string, string>>
  onSubmit: (values: Record<string, string>) => Promise<void>
  submitLabel?: string
  isSubmitting?: boolean
  /** For a caller that submits from its own footer — a drawer, a dialog, the builder's preview. */
  formRef?: RefObject<HTMLFormElement | null>
  hideSubmitButton?: boolean
}

/**
 * A form, rendered from its schema.
 *
 * ⚠️ **Everything it decides lives in `lib/formConditions.ts` and `lib/formValues.ts`.** This component
 * holds the answers and draws them; visibility, requiredness, the cascade that clears hidden answers and
 * the stripping of phantoms are pure functions beside it. That split is the point — those four rules are
 * the ones whose failure is silent.
 */
export function DynamicForm({
  form,
  initialValues = {},
  optionLabels = {},
  onSubmit,
  submitLabel = "Submit",
  isSubmitting = false,
  formRef,
  hideSubmitButton = false,
}: DynamicFormProperties) {
  const [values, setValues] = useState<Record<string, string>>(() => withInferredPhantoms(form, initialValues))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState("")

  // ⚠️ Compared by content, not by identity: a caller that builds `initialValues` inline hands over a
  // new object on every render, and depending on the reference would reset the form under the reader's
  // hands on every keystroke.
  const initialValuesKey = JSON.stringify(initialValues)

  useEffect(() => {
    setValues(withInferredPhantoms(form, initialValues))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValuesKey])

  function setValue(fieldName: string, value: string) {
    setValues((previous) => withoutHiddenValues(form, { ...previous, [fieldName]: value }))

    // The rejection was about the old value; keeping it under a field somebody is currently fixing is
    // how an error message outlives the mistake.
    setErrors((previous) => {
      const next = { ...previous }
      delete next[fieldName]

      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError("")

    try {
      await onSubmit(withoutPhantomValues(form, values))
    } catch (error: unknown) {
      const fieldErrors = fieldErrorsOf(error)

      if (fieldErrors) {
        setErrors(fieldErrors)
        return
      }

      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail

      setSubmitError(detail ?? "Submission failed. Please check the form.")
    }
  }

  const fieldConditions = form.fieldConditions ?? {}

  const sections = sectionsOf(form)
  const titled = hasNamedSections(sections)

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-4">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {sections.map((section, index) => {
        const drawn = section.fields.filter((field) => resolveVisible(field.id, fieldConditions, values))

        // ⚠️ A section whose every field is hidden by a condition draws nothing at all — heading
        // included. A lone heading over empty space reads as something that failed to load.
        if (drawn.length === 0) {
          return null
        }

        return (
          <section key={section.title ?? `unnamed-${index}`} className="flex flex-col gap-2">
            {section.title && titled && (
              <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {section.title}
              </h3>
            )}

            {/* Twelve columns, and below `sm` every field takes the whole row — a half-width date is
                unusable on a phone, which is where a scan-and-record flow actually happens. */}
            <div className="grid grid-cols-12 items-start gap-x-3 gap-y-4">
              {drawn.map((field) => {
                const required = resolveRequired(field.id, field.required, fieldConditions, values)

                // A virtual field that groups children is the one shape that is not a labelled control.
                // ⚠️ A COMPLEX_COMPOSITE is virtual too and is deliberately NOT one: it joins its
                // children into a single piped value, so it has an answer of its own and belongs in an
                // ordinary row.
                const grouping = field.usageType === "VIRTUAL" && field.elementType !== "COMPLEX_COMPOSITE"

                return (
                  <div
                    key={field.id}
                    // ⚠️ A group of children is always a full row whatever its width says: it is a
                    // little form of its own, and half of one beside an unrelated date is a puzzle.
                    className={cn("min-w-0", grouping ? WIDTH_CLASS.full : WIDTH_CLASS[widthOf(field)])}
                  >
                    {grouping ? (
                      <VirtualFieldGroup
                        field={field}
                        values={values}
                        errors={errors}
                        onChange={setValue}
                        required={required}
                      />
                    ) : (
                      <FieldRow
                        field={field}
                        value={values[field.name] ?? ""}
                        onChange={(value) => setValue(field.name, value)}
                        error={errors[field.name]}
                        required={required}
                        draftValues={values}
                        optionLabels={optionLabels[field.name]}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {!hideSubmitButton && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
