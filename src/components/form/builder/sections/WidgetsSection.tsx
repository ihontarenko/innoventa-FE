import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, Input, Skeleton } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField, EditorSection } from "@/components/form/builder/EditorSection"
import { featureBySlug } from "@/components/features/registry"
import {
  useConnectFeature,
  useDisconnectFeature,
  useFeatureCatalog,
  useFormFeatures,
  useUpdateFormFeature,
} from "@/hooks/useFeatures"
import type { FormFeatureBinding, FormFeatureFieldMapping } from "@/api/features"
import type { FieldDetail, FormDetail } from "@/types"

/**
 * ⚠️ **A form may only be given widgets, never tools or aggregators.** A tool has nothing to bind to and
 * an aggregator reads across every entry rather than the one being filled — so the picker is narrowed
 * *here*, at the offer, rather than left for the backend to refuse.
 */
const BINDABLE_KINDS = new Set(["VISUALIZER", "CALCULATOR", "VALIDATOR"])

const OPERATORS = ["equals", "not_equals", "contains", "greater_than", "less_than"]

/**
 * The widgets a form carries, and which of its fields feed each one.
 *
 * ⚠️ **A slot is filled by a *field*, never by a value.** That indirection is the whole reason one
 * widget works on twenty forms: the stock indicator asks for "a quantity" and this panel says which
 * field of *this* form is it.
 *
 * ⚠️ **Every change saves immediately.** A mapping is one reversible fact and there is no draft to
 * assemble — a Save button here is a button people forget, leaving a widget half-bound and silent.
 *
 * ⚠️ **A widget the browser does not implement is shown and marked, not hidden.** The catalogue and the
 * registry are two lists, and a form bound to something this build cannot draw is a fact worth seeing
 * rather than a blank space.
 */
export function WidgetsSection({ form }: { form: FormDetail }) {
  const { data: bindings = [], isLoading } = useFormFeatures(form.id)
  const { data: catalogue = [] } = useFeatureCatalog("WIDGET")

  const connectFeature = useConnectFeature()

  const bound = new Set(bindings.map((binding) => binding.feature.id))
  const offered = catalogue.filter((item) => BINDABLE_KINDS.has(item.category) && !bound.has(item.id))

  return (
    <EditorSection title="Widgets" badge={bindings.length || undefined} defaultOpen={bindings.length > 0}>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing attached. A widget draws something out of an answer — a resistance as colour bands, a
          quantity as a stock light — beside the entry rather than instead of it.
        </p>
      ) : (
        bindings.map((binding) => (
          <BindingBlock key={binding.id} binding={binding} formId={form.id} fields={form.fields} />
        ))
      )}

      {offered.length > 0 && (
        <EditorField label="Attach one">
          <PlainSelect
            value=""
            onChange={(featureId) => {
              if (!featureId) {
                return
              }

              connectFeature.mutate(
                { formId: form.id, featureId, fieldMappings: [] },
                { onError: () => toast.error("That widget was not attached.") },
              )
            }}
          >
            <option value="">— pick a widget —</option>
            {offered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </PlainSelect>
        </EditorField>
      )}
    </EditorSection>
  )
}

function BindingBlock({
  binding,
  formId,
  fields,
}: {
  binding: FormFeatureBinding
  formId: string
  fields: FieldDetail[]
}) {
  const updateFeature = useUpdateFormFeature()
  const disconnectFeature = useDisconnectFeature()

  const [removing, setRemoving] = useState(false)

  const entry = featureBySlug(binding.feature.slug)
  const isDynamic = entry?.dynamicSlots === true

  function mappingFor(inputKey: string): FormFeatureFieldMapping {
    return binding.fieldMappings.find((mapping) => mapping.inputKey === inputKey) ?? { inputKey, fieldName: "" }
  }

  /** ⚠️ Clearing the field **removes** the mapping — an empty `fieldName` is not a mapping to nothing. */
  function save(inputKey: string, patch: Partial<FormFeatureFieldMapping>) {
    const updated = { ...mappingFor(inputKey), ...patch }
    const others = binding.fieldMappings.filter((mapping) => mapping.inputKey !== inputKey)

    updateFeature.mutate(
      {
        formId,
        bindingId: binding.id,
        fieldMappings: updated.fieldName ? [...others, updated] : others,
      },
      { onError: () => toast.error("That was not saved.") },
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{binding.feature.name}</span>

        {!entry && (
          <Badge variant="destructive" title="Bound here but not implemented in this build">
            not drawable
          </Badge>
        )}

        {removing ? (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto"
            onClick={() => {
              disconnectFeature.mutate(
                { formId, bindingId: binding.id },
                { onError: () => toast.error("That was not detached.") },
              )
              setRemoving(false)
            }}
          >
            Really detach
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:bg-destructive/10"
            onClick={() => setRemoving(true)}
          >
            Detach
          </Button>
        )}
      </div>

      {isDynamic ? (
        <DynamicRules binding={binding} fields={fields} onSave={save} />
      ) : (
        binding.feature.inputSlots.map((slot) => (
          <EditorField
            key={slot.inputKey}
            label={slot.label}
            hint={slot.required ? undefined : "Optional."}
          >
            <PlainSelect
              value={mappingFor(slot.inputKey).fieldName}
              onChange={(fieldName) => save(slot.inputKey, { fieldName })}
            >
              <option value="">— not mapped —</option>
              {eligibleFields(fields, slot.acceptedFieldTypes).map((field) => (
                <option key={field.id} value={field.name}>
                  {field.label}
                </option>
              ))}
            </PlainSelect>
          </EditorField>
        ))
      )}
    </div>
  )
}

/**
 * A widget whose slots are the *form's own questions* — the quiz grader.
 *
 * ⚠️ **Each rule is keyed by the field it grades, so `inputKey` and `fieldName` are the same string.**
 * That looks redundant and is not: the binding shape is one map for every widget, and a quiz simply has
 * as many slots as the form has questions rather than a fixed list declared up front.
 */
function DynamicRules({
  binding,
  fields,
  onSave,
}: {
  binding: FormFeatureBinding
  fields: FieldDetail[]
  onSave: (inputKey: string, patch: Partial<FormFeatureFieldMapping>) => void
}) {
  const [fieldName, setFieldName] = useState("")
  const [operator, setOperator] = useState("equals")
  const [expected, setExpected] = useState("")

  const graded = new Set(binding.fieldMappings.map((mapping) => mapping.inputKey))
  const ungraded = fields.filter((field) => !graded.has(field.name))

  return (
    <>
      {binding.fieldMappings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No rules yet. Each rule says what the right answer to one question is.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {binding.fieldMappings.map((mapping) => {
            const field = fields.find((one) => one.name === mapping.inputKey)

            return (
              <li key={mapping.inputKey} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs">
                <span className="font-medium">{field?.label ?? mapping.inputKey}</span>
                <span className="text-muted-foreground">{mapping.operator ?? "equals"}</span>
                <span className="font-mono">{mapping.expectedValue}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive hover:bg-destructive/10"
                  onClick={() => onSave(mapping.inputKey, { fieldName: "" })}
                >
                  ✕
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {ungraded.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <EditorField label="Question">
            <PlainSelect value={fieldName} onChange={setFieldName}>
              <option value="">— pick one —</option>
              {ungraded.map((field) => (
                <option key={field.id} value={field.name}>
                  {field.label}
                </option>
              ))}
            </PlainSelect>
          </EditorField>

          <EditorField label="Is">
            <PlainSelect value={operator} onChange={setOperator}>
              {OPERATORS.map((one) => (
                <option key={one} value={one}>
                  {one.replace(/_/g, " ")}
                </option>
              ))}
            </PlainSelect>
          </EditorField>

          <EditorField label="Answer">
            <Input
              className="h-8 text-sm"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
            />
          </EditorField>

          <Button
            size="sm"
            disabled={!fieldName || !expected.trim()}
            onClick={() => {
              onSave(fieldName, { fieldName, operator, expectedValue: expected.trim() })
              setFieldName("")
              setExpected("")
            }}
          >
            Add rule
          </Button>
        </div>
      )}
    </>
  )
}

/**
 * ⚠️ **`acceptedFieldTypes` narrows the offer; it does not enforce anything.** The backend refuses a
 * mapping that cannot work — this only keeps a list of forty fields down to the six that could plausibly
 * fill the slot. An empty declaration means every field is fair game.
 */
function eligibleFields(fields: FieldDetail[], acceptedFieldTypes: string | null): FieldDetail[] {
  if (!acceptedFieldTypes) {
    return fields
  }

  const types = acceptedFieldTypes.split(",").map((type) => type.trim())

  return fields.filter((field) => types.includes(field.elementType))
}
