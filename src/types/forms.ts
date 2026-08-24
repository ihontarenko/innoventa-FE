/**
 * The form model — a form, its fields, and the conditions between them.
 *
 * These are the shapes the engine in `lib/formConditions.ts` reasons about and the controls render.
 * Ported as-is from the old interface: the names are the backend's, and renaming them here would only
 * mean translating at every boundary.
 */

export type ElementType =
  | "TEXT"
  | "NUMBER"
  | "TEXTAREA"
  | "RANGE"
  | "SELECT"
  | "MULTISELECT"
  | "RADIO"
  | "CHECKBOX"
  | "CHECKBOXES"
  | "TOGGLE"
  | "EMAIL"
  | "URL"
  | "DATE"
  | "TAGS"
  | "FILE"
  | "IMAGE"
  | "COLOR"
  | "RATING"
  | "NONE"
  | "SIMPLE_COMPOSITE"
  | "COMPLEX_COMPOSITE"

/**
 * How a field participates.
 *
 * ⚠️ **`PHANTOM` is the form's own bookkeeping**, not an answer — the hidden chooser a virtual field
 * uses to decide which child to show. It is inferred back in on load and stripped before submit, and
 * nothing else in the model behaves that way.
 */
export type UsageType = "STANDALONE" | "VIRTUAL" | "EMBEDDABLE" | "PHANTOM"

export type FieldStatus = "ACTIVE" | "INACTIVE" | "DELETED"

export type FormStatus = "ACTIVE" | "INACTIVE" | "DELETED"

/** Who may open the form: workspace members, anybody with the link, or staff only. */
export type FormAudience = "MEMBERS" | "EVERYONE" | "STAFF"

export interface FieldOption {
  id: string
  optionValue: string
  optionLabel: string
  sortOrder: number
}

export interface FieldSummary {
  id: string
  name: string
  label: string
  icon: string | null
  usageType: UsageType
  elementType: ElementType
  unit: string | null
  required: boolean
  sortOrder: number
  status: FieldStatus
  options: FieldOption[]
}

export interface FieldDetail extends FieldSummary {
  description: string | null
  attributes: Record<string, string>
  configs: Record<string, string>
  validationExpressions: string[]
  children: FieldSummary[]
  childConditions: Record<string, FieldCondition>
  createdAt: string
  updatedAt: string
}

/**
 * One rule: when the field named by `triggerFieldName` satisfies `operator` against `expectedValue`,
 * do `action`.
 *
 * ⚠️ `operator` is a plain string rather than the union, because the backend owns the vocabulary and a
 * value it adds must not stop a form from rendering. {@link evaluateOperator} answers `false` for one
 * it does not know — a rule that never fires, rather than a screen that never paints.
 */
export interface FieldCondition {
  triggerFieldName: string
  operator: string
  expectedValue: string | null
  action: "show" | "hide" | "require" | "optional"
}

export interface FormPurpose {
  id: string
  code: string
  label: string
  description: string | null
  icon: string | null
  sortOrder: number
  system: boolean
}

export interface FormCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  purpose: FormPurpose
}

export interface FormSummary {
  id: string
  name: string
  codename: string | null
  description: string | null
  icon: string | null
  status: FormStatus
  audience: FormAudience
  shareToken: string | null
  purpose: FormPurpose | null
  category: FormCategory | null
  fieldCount: number
  createdAt: string
  updatedAt: string
}

export interface FormDetail extends Omit<FormSummary, "fieldCount"> {
  fields: FieldDetail[]
  config: Record<string, string>
  /** Keyed by field id — the rule that decides whether that field shows, and whether it is required. */
  fieldConditions: Record<string, FieldCondition>
}

export interface FormEntry {
  id: string
  formId: string
  /** The form's display name, resolved server-side so cross-space listings need not look it up. */
  formName: string
  /** The owning workspace, or null for public / workspace-less submissions. */
  spaceId: string | null
  submitterId: string | null
  submitterEmail: string | null
  fieldValues: Record<string, string>
  /**
   * What this entry's stored choices read as: field name → stored value → label.
   *
   * Present for every field whose choices come from a source, so a reference renders as a name rather
   * than an identifier, and one that has lost what it pointed at renders as `‹deleted›`. A field missing
   * from here is one to label the way it always was, from the field's own option rows.
   */
  optionLabels?: Record<string, Record<string, string>>
  shareToken: string | null
  createdAt: string
  updatedAt: string
}

/**
 * How a submission is attributed to somebody, and therefore what "already answered" can mean.
 *
 * ⚠️ **`ANONYMOUS` is not "no policy" — it is a policy that cannot count.** With nothing identifying a
 * submitter, a cap per identity has no identity to cap, so the limits below are only meaningful under
 * one of the other three.
 */
export type IdentityStrategy = "ANONYMOUS" | "USER" | "IP" | "EMAIL"

/**
 * What a public form does when the same person answers twice.
 *
 * ⚠️ **Absent means unrestricted.** `GET …/submission-policy` answers 404 for a form nobody has
 * constrained, and deleting the policy is how a form goes back to that — never saving one with the
 * limits blanked, which is a policy that permits everything and reads as if somebody meant something.
 */
export interface SubmissionPolicy {
  id: string
  resubmissionAllowed: boolean
  maxPerIdentity: number | null
  cooldownMinutes: number | null
  identityStrategy: IdentityStrategy
  identityFieldName: string | null
  createdAt: string | null
  updatedAt: string | null
}
