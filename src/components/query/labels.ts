import type { QueryLabels } from "@jmouse/query"

/**
 * The builder's words, in Innoventa's language.
 *
 * ⚠️ Props rather than a translation service, deliberately — see `@jmouse/query`'s `labels.ts`. Two of
 * these products do not use the same translation service, so a shared component that reached for one
 * would force them together over a row of chip captions.
 *
 * ⚠️ **English, because this interface is.** These captions were Ukrainian while every other string
 * around them — page titles, empty states, the `Overdue` chip beside the filter — was English, so one
 * screen spoke two languages and the filter was the half that stood out. A product with no translation
 * service has one language, and the honest thing is to write it rather than to leave a second one in the
 * one file nobody looked at.
 */
export const QUERY_LABELS: Partial<QueryLabels> = {
  operators: {
    contains: "contains",
    notContains: "does not contain",
    starts: "starts with",
    ends: "ends with",
    equals: "is",
    notEquals: "is not",
    greater: "is more than",
    greaterOrEqual: "is at least",
    less: "is less than",
    lessOrEqual: "is at most",
    empty: "is empty",
    notEmpty: "is not empty",
  },
  builderTab: "Builder",
  textTab: "Text",
  noConditions: "No conditions — the list shows everything. Add one to narrow it.",
  addCondition: "Condition",
  removeCondition: "Remove condition",
  field: "Field",
  value: "Value",
  includeMissing: "and those with no such field at all",
  sortBy: "Sort by",
  sortDefault: "Default",
  descending: "descending",
  reset: "Reset",
  apply: "Apply",
  presets: "Ready-made questions",
  handWritten:
    "⚠️ This query was written by hand, and the builder does not try to redraw it — quietly rewriting " +
    "somebody's expression is worse than saying so. Edit it as text.",
  readable: "The query reads.",
  converterNote: (converter) =>
    `⚠️ This field is stored as text, so a comparison is read as a number — | ${converter} is added to ` +
    `the query. Without it, "900" would be greater than "1000".`,
}
