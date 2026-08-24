import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Zap } from "lucide-react"
import { Button, Input, Popover, PopoverContent, PopoverTrigger, cn } from "@jmouse/ui"
import { fieldsApi } from "@/api/fields"
import type { FieldCondition, FieldDetail, FieldSummary } from "@/types"

/**
 * When one child of a group shows, decided by another child of the same group.
 *
 * ⚠️ **A child's condition is scoped to its group, not to the form.** The trigger list is the group's
 * own children — a rule pointing at a field elsewhere on the form would be evaluated against values the
 * group never sees, and would silently never fire.
 *
 * ⚠️ **This is where PHANTOM earns its keep.** The usual shape is a phantom chooser plus one data child
 * per choice, each shown by a rule against the chooser. `withInferredPhantoms` reads these very rules
 * backwards to reconstruct the chooser when an entry is reopened — so an `expectedValue` typed here is
 * the value that will be inferred later.
 */
const ACTIONS: Array<{ value: FieldCondition["action"]; label: string }> = [
  { value: "show", label: "show" },
  { value: "hide", label: "hide" },
  { value: "require", label: "require" },
  { value: "optional", label: "make optional" },
]

const OPERATORS = ["equals", "not_equals", "contains", "is_empty", "is_not_empty"]
const VALUELESS_OPERATORS = new Set(["is_empty", "is_not_empty"])

export function ChildConditionEditor({
  parent,
  child,
  condition,
}: {
  parent: FieldDetail
  child: FieldSummary
  condition: FieldCondition | null
}) {
  const queryClient = useQueryClient()
  const [isOpen, setOpen] = useState(false)
  const [draft, setDraft] = useState<FieldCondition>(
    condition ?? { triggerFieldName: "", operator: "equals", expectedValue: "", action: "show" },
  )

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["fields", parent.id] })
    queryClient.invalidateQueries({ queryKey: ["forms"] })
  }

  const setCondition = useMutation({
    mutationFn: () =>
      fieldsApi.setChildCondition(parent.id, child.id, {
        ...draft,
        expectedValue: VALUELESS_OPERATORS.has(draft.operator) ? null : (draft.expectedValue ?? ""),
      }),
    onSuccess: () => {
      invalidate()
      setOpen(false)
    },
  })

  const clearCondition = useMutation({
    mutationFn: () => fieldsApi.clearChildCondition(parent.id, child.id),
    onSuccess: () => {
      invalidate()
      setOpen(false)
    },
  })

  const siblings = (parent.children ?? []).filter((candidate) => candidate.id !== child.id)
  const needsValue = !VALUELESS_OPERATORS.has(draft.operator)

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-6", condition && "text-primary")}
          aria-label={condition ? `Condition on ${child.label}` : `Add a condition to ${child.label}`}
          title={
            condition
              ? `${condition.action} when ${condition.triggerFieldName} ${condition.operator} ${condition.expectedValue ?? ""}`
              : "No condition"
          }
        >
          <Zap className={cn("size-3", !condition && "opacity-40")} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">When</span>
            <select
              className="h-8 rounded-md border bg-transparent px-1.5 text-xs"
              value={draft.triggerFieldName}
              onChange={(event) => setDraft({ ...draft, triggerFieldName: event.target.value })}
            >
              <option value="">— sibling</option>
              {siblings.map((sibling) => (
                <option key={sibling.id} value={sibling.name}>
                  {sibling.label}
                  {sibling.usageType === "PHANTOM" ? " (chooser)" : ""}
                </option>
              ))}
            </select>

            <select
              className="h-8 rounded-md border bg-transparent px-1.5 font-mono text-xs"
              value={draft.operator}
              onChange={(event) => setDraft({ ...draft, operator: event.target.value })}
            >
              {OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>

            {needsValue && (
              <Input
                className="h-8 w-28 text-xs"
                placeholder="value"
                value={draft.expectedValue ?? ""}
                onChange={(event) => setDraft({ ...draft, expectedValue: event.target.value })}
              />
            )}

            <span className="text-muted-foreground">then</span>
            <select
              className="h-8 rounded-md border bg-transparent px-1.5 text-xs"
              value={draft.action}
              onChange={(event) => setDraft({ ...draft, action: event.target.value as FieldCondition["action"] })}
            >
              {ACTIONS.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          {siblings.length === 0 && (
            <span className="text-xs text-muted-foreground">
              A condition needs another child to react to — add a second one first.
            </span>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!draft.triggerFieldName || setCondition.isPending}
              onClick={() => setCondition.mutate()}
            >
              Apply
            </Button>
            {condition && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={clearCondition.isPending}
                onClick={() => clearCondition.mutate()}
              >
                Remove
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
