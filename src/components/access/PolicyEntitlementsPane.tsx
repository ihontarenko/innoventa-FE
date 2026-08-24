import { Badge, Input, TableCell, TableRow } from "@jmouse/ui"
import type { PolicyEntitlementKind, PolicyEntitlementView, PolicyVocabularyView } from "@/api/policy"
import { InstanceName } from "./PolicyInstancePicker"
import {
  CapabilitySelect,
  ChipRow,
  EditorField,
  EditorGrid,
  MonoBadge,
  OpenCell,
  PlainSelect,
  PolicyEditorDialog,
  PolicySection,
  RowMuted,
  ScopePicker,
  applyToList,
  removeFromList,
  useSectionEditing,
} from "./PolicyEditingKit"

const BLANK_ENTITLEMENT: PolicyEntitlementView = {
  scope: "ORGANIZATION",
  instance: "*",
  kind: "PLAN",
  subject: "",
  quantity: null,
  unlimited: false,
  from: null,
  until: null,
  reason: null,
}

/**
 * Grants somebody wrote down deliberately — a tier, a trial, a gift, a withholding.
 *
 * ⚠️ **`from` and `until` are fields, and that is the design.** A window could have been a condition and
 * deliberately is not. A predicate is opaque: it returns a boolean and nothing else, so an expired grant
 * inside one would be indistinguishable from a refused one — no *"ended on the 12th"* to quote, and
 * nothing for these two date fields to hold.
 *
 * ⚠️ **A tier line is seeded as a plan grant.** `plan business` here becomes one capability grant per
 * line the tier includes, each carrying the tier as its source — which is what makes *"what tier is this
 * account on"* answerable without a column saying so.
 */
export function PolicyEntitlementsPane({
  entitlements,
  vocabulary,
  readOnly,
  onChange,
}: {
  entitlements: PolicyEntitlementView[]
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyEntitlementView[]) => void
}) {
  const { editing, open, close } = useSectionEditing<PolicyEntitlementView>()

  return (
    <>
      <PolicySection
        label="Entitlements — who is on what, and until when"
        addLabel="Add entitlement"
        readOnly={readOnly}
        onAdd={() =>
          open(null, {
            ...BLANK_ENTITLEMENT,
            scope: vocabulary?.scopes[0]?.name ?? "ORGANIZATION",
            subject: vocabulary?.plans[0] ?? "",
          })
        }
        columns={["Where", "What", "Of", "Window", "Why"]}
        count={entitlements.length}
        empty={{
          glyph: "◈",
          title: "Nothing entitled here",
          message:
            "Putting an account on a tier is ordinarily a row that the plans screen writes. A line here is for what an installation is born with, or for a deny.",
        }}
      >
        {entitlements.map((entitlement, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <MonoBadge>@{entitlement.scope}</MonoBadge>
                {entitlement.instance && (
                  <InstanceName
                    kind={entitlement.scope === "ORGANIZATION" ? "ORGANIZATION" : "SPACE"}
                    id={entitlement.instance}
                  />
                )}
              </div>
            </TableCell>
            <TableCell>
              {/* A denial is the one kind that takes something away, so it is the one kind coloured. */}
              <Badge variant={entitlement.kind === "DENY" ? "destructive" : "default"}>
                {entitlement.kind.toLowerCase()}
              </Badge>
            </TableCell>
            <TableCell>
              <ChipRow>
                <MonoBadge>{entitlement.subject || "—"}</MonoBadge>
                {entitlement.unlimited && <Badge>unlimited</Badge>}
                {!entitlement.unlimited && entitlement.quantity && <MonoBadge>{entitlement.quantity}</MonoBadge>}
              </ChipRow>
            </TableCell>
            <TableCell>
              <RowMuted>{describeWindow(entitlement)}</RowMuted>
            </TableCell>
            <TableCell>{entitlement.reason || <RowMuted>—</RowMuted>}</TableCell>
            <OpenCell readOnly={readOnly} onOpen={() => open(index, entitlement)} />
          </TableRow>
        ))}
      </PolicySection>

      {editing && (
        <PolicyEditorDialog
          key={editing.index ?? "new"}
          title={editing.index === null ? "New entitlement" : "Entitlement"}
          description="What one place is given, or refused — and for how long."
          initial={editing.initial}
          readOnly={readOnly}
          width="sm:max-w-2xl"
          onClose={close}
          onApply={(next) => onChange(applyToList(entitlements, editing.index, next))}
          onRemove={editing.index === null ? undefined : () => onChange(removeFromList(entitlements, editing.index!))}
        >
          {(draft, setDraft) => (
            <EntitlementEditor entitlement={draft} vocabulary={vocabulary} readOnly={readOnly} onChange={setDraft} />
          )}
        </PolicyEditorDialog>
      )}
    </>
  )
}

/** "from 1 Mar", "until 30 Jun", "1 Mar → 30 Jun", or nothing at all — never a half-written range. */
function describeWindow(entitlement: PolicyEntitlementView): string {
  if (entitlement.from && entitlement.until) {
    return `${entitlement.from} → ${entitlement.until}`
  }

  if (entitlement.from) {
    return `from ${entitlement.from}`
  }

  if (entitlement.until) {
    return `until ${entitlement.until}`
  }

  return "always"
}

function EntitlementEditor({
  entitlement,
  vocabulary,
  readOnly,
  onChange,
}: {
  entitlement: PolicyEntitlementView
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyEntitlementView) => void
}) {
  return (
    <>
      {/* ⚠️ Outside the grid, because it is two controls rather than one: a scope kind and — only where
          the kind carries one — which place. Inside a column sized for a single field they would have to
          shrink until a workspace name was unreadable. */}
      <EditorField label="Where">
        <ScopePicker
          scope={entitlement.scope}
          instance={entitlement.instance}
          vocabulary={vocabulary}
          disabled={readOnly}
          onChange={(scope, instance) => onChange({ ...entitlement, scope, instance })}
        />
      </EditorField>

      <EditorGrid>
        <EditorField label="What">
          <PlainSelect
            value={entitlement.kind}
            disabled={readOnly}
            onChange={(kind) =>
              onChange({
                ...entitlement,
                kind: kind as PolicyEntitlementKind,
                // The subject means a different thing on either side of this choice — a tier code for a
                // bundle, a capability key otherwise — so carrying the old value across would name a
                // tier that is not a capability.
                subject: "",
              })
            }
          >
            <option value="PLAN">plan — everything that tier includes</option>
            <option value="TRIAL">trial — the same, with an end</option>
            <option value="ALLOW">allow — one capability</option>
            <option value="DENY">deny — take one away</option>
          </PlainSelect>
        </EditorField>

        <EditorField label="Of">
          {isBundle(entitlement) ? (
            <PlainSelect
              value={entitlement.subject}
              disabled={readOnly}
              onChange={(subject) => onChange({ ...entitlement, subject })}
            >
              <option value="">which tier?</option>
              {(vocabulary?.plans ?? []).map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </PlainSelect>
          ) : (
            <CapabilitySelect
              value={entitlement.subject}
              vocabulary={vocabulary}
              disabled={readOnly}
              onChange={(subject) => onChange({ ...entitlement, subject })}
            />
          )}
        </EditorField>

        {/* An amount belongs to `allow` alone: a bundle's amounts are the tier's, and a denial removes
            the capability outright rather than arguing with a number. */}
        {entitlement.kind === "ALLOW" && (
          <EditorField label="How many">
            <Input
              className="h-8 text-sm"
              value={entitlement.unlimited ? "" : (entitlement.quantity ?? "")}
              disabled={readOnly || entitlement.unlimited}
              placeholder="25 or 100GB"
              onChange={(event) => onChange({ ...entitlement, quantity: event.target.value || null })}
            />
          </EditorField>
        )}

        <EditorField label="From" hint="Granted, and not open yet — the date is the whole of what to wait for.">
          <Input
            className="h-8 text-sm"
            type="date"
            value={entitlement.from ?? ""}
            disabled={readOnly}
            onChange={(event) => onChange({ ...entitlement, from: event.target.value || null })}
          />
        </EditorField>

        <EditorField label="Until" hint="Expiry is a date being read, never a scheduled job.">
          <Input
            className="h-8 text-sm"
            type="date"
            value={entitlement.until ?? ""}
            disabled={readOnly}
            onChange={(event) => onChange({ ...entitlement, until: event.target.value || null })}
          />
        </EditorField>
      </EditorGrid>

      <EditorField label="Why">
        <Input
          className="h-8 text-sm"
          value={entitlement.reason ?? ""}
          disabled={readOnly}
          placeholder={
            entitlement.kind === "DENY"
              ? "why this is withheld — the reader sees this"
              : "why, for whoever reads this in a year"
          }
          onChange={(event) => onChange({ ...entitlement, reason: event.target.value || null })}
        />
      </EditorField>
    </>
  )
}

function isBundle(entitlement: PolicyEntitlementView): boolean {
  return entitlement.kind === "PLAN" || entitlement.kind === "TRIAL"
}
