import { useState } from "react"
import { Button, Input, NativeSelect } from "@jmouse/ui"
import type { FieldCondition, FieldDetail, FormDetail } from "@/types"
import { useClearFieldCondition, useSetFieldCondition } from "@/hooks/useForms"
import { EditorField, EditorSection } from "../EditorSection"

/**
 * When this field shows, and when it must be answered.
 *
 * ⚠️ **A condition belongs to the FORM, not to the field.** The same field on two forms can carry two
 * different rules, which is why this section saves on its own endpoint the moment it is applied rather
 * than joining the field's own draft and its Save button.
 */
const ACTIONS: Array<{ value: FieldCondition["action"]; label: string }> = [
  { value: "show", label: "show this field" },
  { value: "hide", label: "hide this field" },
  { value: "require", label: "make it required" },
  { value: "optional", label: "make it optional" },
]

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "starts_with",
  "ends_with",
  "greater_than",
  "greater_than_or_equals",
  "less_than",
  "less_than_or_equals",
  "is_empty",
  "is_not_empty",
]

/** The two that compare against nothing — the value box is meaningless for them. */
const VALUELESS_OPERATORS = new Set(["is_empty", "is_not_empty"])

export function ConditionSection({
  form,
  field,
  condition,
}: {
  form: FormDetail
  field: FieldDetail
  condition: FieldCondition | null
}) {
  const setCondition = useSetFieldCondition(form.id)
  const clearCondition = useClearFieldCondition(form.id)

  const [draft, setDraft] = useState<FieldCondition>(
    condition ?? { triggerFieldName: "", operator: "equals", expectedValue: "", action: "show" },
  )

  // A field cannot depend on itself, and a rule pointing at a group's own children would fire before
  // they exist.
  const triggers = form.fields.filter((candidate) => candidate.id !== field.id && candidate.status !== "DELETED")
  const needsValue = !VALUELESS_OPERATORS.has(draft.operator)

  return (
    <EditorSection title="Condition" icon="⚡" badge={condition ? "set" : undefined} defaultOpen={!!condition}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs">
        <span className="text-muted-foreground">When</span>
        <NativeSelect
          value={draft.triggerFieldName}
          onChange={(event) => setDraft({ ...draft, triggerFieldName: event.target.value })}
        >
          <option value="">— pick a field</option>
          {triggers.map((candidate) => (
            <option key={candidate.id} value={candidate.name}>
              {candidate.label}
            </option>
          ))}
        </NativeSelect>

        <span className="text-muted-foreground">is</span>
        <div className="flex gap-2">
          <NativeSelect
            className="font-mono"
            value={draft.operator}
            onChange={(event) => setDraft({ ...draft, operator: event.target.value })}
          >
            {OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </NativeSelect>

          {needsValue && (
            <Input
              className="text-sm"
              placeholder="value"
              value={draft.expectedValue ?? ""}
              onChange={(event) => setDraft({ ...draft, expectedValue: event.target.value })}
            />
          )}
        </div>

        <span className="text-muted-foreground">then</span>
        <NativeSelect
          value={draft.action}
          onChange={(event) => setDraft({ ...draft, action: event.target.value as FieldCondition["action"] })}
        >
          {ACTIONS.map((action) => (
            <option key={action.value} value={action.value}>
              {action.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <EditorField
        label=""
        hint="⚠️ Hiding a field also clears whatever was answered in it — that is what stops an entry holding a fact its own form says cannot exist."
      >
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!draft.triggerFieldName || setCondition.isPending}
            onClick={() =>
              setCondition.mutate({
                fieldId: field.id,
                condition: { ...draft, expectedValue: needsValue ? (draft.expectedValue ?? "") : null },
              })
            }
          >
            Apply
          </Button>

          {condition && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={clearCondition.isPending}
              onClick={() => clearCondition.mutate(field.id)}
            >
              Remove condition
            </Button>
          )}
        </div>
      </EditorField>
    </EditorSection>
  )
}
