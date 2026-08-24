import { Badge, Input, Switch, TableCell, TableRow } from "@jmouse/ui"
import type { PolicyPlanLineView, PolicyPlanView, PolicyVocabularyView } from "@/api/policy"
import {
  CapabilitySelect,
  ChipRow,
  EditorField,
  EditorGrid,
  Line,
  LineCell,
  LineTable,
  MonoBadge,
  OpenCell,
  PlainSelect,
  PolicyEditorDialog,
  PolicySection,
  RemoveCell,
  RowMuted,
  applyToList,
  removeFromList,
  useSectionEditing,
} from "./PolicyEditingKit"

const BLANK_PLAN: PolicyPlanView = {
  code: "",
  displayName: "",
  order: 0,
  note: null,
  extendsCode: null,
  lines: [],
}

/**
 * The tiers.
 *
 * ⚠️ **The lines shown are the ones this tier *writes*.** A derived tier states only its differences.
 * Rendering what it *confers* would make the next save write the inherited lines out too — flattening
 * `extends` into a copy that drifts from its base at the first edit, which is the exact thing `extends`
 * exists to prevent.
 *
 * ⚠️ **Editing a tier does not reissue it.** Grants are materialised at the **moment of assignment** and
 * are rows from then on. A change here reaches the next account put on this tier and nobody already on
 * it — deliberate, because a text edit that silently re-provisioned every paying customer would be a
 * mass mutation wearing the clothes of a diff.
 */
export function PolicyPlansPane({
  plans,
  vocabulary,
  readOnly,
  onChange,
}: {
  plans: PolicyPlanView[]
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyPlanView[]) => void
}) {
  const { editing, open, close } = useSectionEditing<PolicyPlanView>()

  return (
    <>
      <PolicySection
        label="Plans — what each tier includes"
        addLabel="Add plan"
        readOnly={readOnly}
        onAdd={() => open(null, { ...BLANK_PLAN, order: (plans.at(-1)?.order ?? 0) + 10 })}
        columns={["Tier", "Called", "Order", "Builds on", "Includes"]}
        count={plans.length}
        note={
          <>
            ⚠️ Editing a tier <strong>does not reissue it.</strong> Accounts already on it keep the grants they were
            given; a change reaches the next account put on it.
          </>
        }
        empty={{
          glyph: "▤",
          title: "No tiers declared",
          message:
            "A tier is a named bundle of capabilities — the same kind of thing a role is for permissions. It carries no price.",
        }}
      >
        {plans.map((plan, index) => (
          <TableRow key={index}>
            <TableCell>
              <MonoBadge>{plan.code || "unnamed"}</MonoBadge>
            </TableCell>
            <TableCell>{plan.displayName || <RowMuted>—</RowMuted>}</TableCell>
            <TableCell className="font-mono text-xs">{plan.order}</TableCell>
            <TableCell>
              {plan.extendsCode ? <MonoBadge>{plan.extendsCode}</MonoBadge> : <RowMuted>nothing</RowMuted>}
            </TableCell>
            <TableCell>
              {plan.lines.length === 0 ? (
                <RowMuted>nothing</RowMuted>
              ) : (
                <ChipRow title={plan.lines.map(describeLine).join("\n")}>
                  {plan.lines.slice(0, 4).map((line, at) => (
                    <MonoBadge key={at}>{describeLine(line)}</MonoBadge>
                  ))}
                  {plan.lines.length > 4 && <Badge variant="outline">+{plan.lines.length - 4} more</Badge>}
                </ChipRow>
              )}
            </TableCell>
            <OpenCell readOnly={readOnly} onOpen={() => open(index, plan)} />
          </TableRow>
        ))}
      </PolicySection>

      {editing && (
        <PolicyEditorDialog
          key={editing.index ?? "new"}
          title={editing.index === null ? "New plan" : `Plan · ${editing.initial.code}`}
          description="Only the lines this tier writes. Where it builds on another, that one still supplies the rest."
          initial={editing.initial}
          readOnly={readOnly}
          onClose={close}
          onApply={(next) => onChange(applyToList(plans, editing.index, next))}
          onRemove={editing.index === null ? undefined : () => onChange(removeFromList(plans, editing.index!))}
        >
          {(draft, setDraft) => (
            <PlanEditor plan={draft} plans={plans} vocabulary={vocabulary} readOnly={readOnly} onChange={setDraft} />
          )}
        </PolicyEditorDialog>
      )}
    </>
  )
}

/** `workspace 25`, `storage-byte 100GB per month`, `seat unlimited` — the line as the file writes it. */
function describeLine(line: PolicyPlanLineView): string {
  if (line.unlimited) {
    return `${line.capability} unlimited`
  }

  if (!line.quantity) {
    return line.capability
  }

  return `${line.capability} ${line.quantity}${line.period ? ` ${line.period}` : ""}`
}

function PlanEditor({
  plan,
  plans,
  vocabulary,
  readOnly,
  onChange,
}: {
  plan: PolicyPlanView
  plans: PolicyPlanView[]
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyPlanView) => void
}) {
  function replaceLines(lines: PolicyPlanLineView[]) {
    onChange({ ...plan, lines })
  }

  function editLine(at: number, next: Partial<PolicyPlanLineView>) {
    replaceLines(plan.lines.map((candidate, index) => (index === at ? { ...candidate, ...next } : candidate)))
  }

  return (
    <>
      <EditorGrid>
        <EditorField label="Tier">
          <Input
            className="h-8 font-mono text-sm"
            value={plan.code}
            disabled={readOnly}
            placeholder="business"
            onChange={(event) => onChange({ ...plan, code: event.target.value })}
          />
        </EditorField>

        <EditorField label="Called">
          <Input
            className="h-8 text-sm"
            value={plan.displayName ?? ""}
            disabled={readOnly}
            placeholder="Business"
            onChange={(event) => onChange({ ...plan, displayName: event.target.value })}
          />
        </EditorField>

        <EditorField label="Order" hint="Where it sits in the ladder. Lower comes first.">
          <Input
            className="h-8 text-sm"
            type="number"
            value={String(plan.order)}
            disabled={readOnly}
            onChange={(event) => onChange({ ...plan, order: Number(event.target.value) || 0 })}
          />
        </EditorField>

        {/* A tier may only extend one that is declared — offering a free-text box here is how a document
            comes to name a base nothing defines, which fails at load rather than here where somebody
            could fix it. */}
        <EditorField label="Builds on" hint="Only the differences are written; the base supplies the rest.">
          <PlainSelect
            value={plan.extendsCode ?? ""}
            disabled={readOnly}
            onChange={(extendsCode) => onChange({ ...plan, extendsCode: extendsCode || null })}
          >
            <option value="">extends nothing</option>
            {plans
              .filter((candidate) => candidate.code && candidate.code !== plan.code)
              .map((candidate) => (
                <option key={candidate.code} value={candidate.code}>
                  extends {candidate.code}
                </option>
              ))}
          </PlainSelect>
        </EditorField>
      </EditorGrid>

      {/* Metadata goes in the header and never in the body: a body mixing `note "…"` with `workspace 1`
          would make the grammar depend on no product ever naming a capability `note`. */}
      <EditorField label="Note">
        <Input
          className="h-8 text-sm"
          value={plan.note ?? ""}
          disabled={readOnly}
          placeholder="What this tier is for, in one sentence"
          onChange={(event) => onChange({ ...plan, note: event.target.value || null })}
        />
      </EditorField>

      <LineTable
        heading="Capabilities"
        columns={["Capability", "How many", "Per", "No ceiling"]}
        count={plan.lines.length}
        quiet="This tier includes nothing of its own. Where it builds on another, that one still supplies its lines."
        addLabel={readOnly ? undefined : "Add capability"}
        onAdd={() =>
          replaceLines([
            ...plan.lines,
            { capability: vocabulary?.capabilities[0]?.key ?? "", quantity: null, period: null, unlimited: false },
          ])
        }
      >
        {plan.lines.map((line, at) => (
          <PlanLineRow
            key={at}
            line={line}
            vocabulary={vocabulary}
            readOnly={readOnly}
            onChange={(next) => editLine(at, next)}
            onRemove={() => replaceLines(removeFromList(plan.lines, at))}
          />
        ))}
      </LineTable>
    </>
  )
}

function PlanLineRow({
  line,
  vocabulary,
  readOnly,
  onChange,
  onRemove,
}: {
  line: PolicyPlanLineView
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: Partial<PolicyPlanLineView>) => void
  onRemove: () => void
}) {
  const declared = vocabulary?.capabilities.find((candidate) => candidate.key === line.capability)

  // A gate carries no number, so the amount cells are empty rather than merely disabled. A greyed-out
  // field beside a capability that can never have one is a control that lies.
  const metered = declared === undefined || declared.kind !== "MODULE"

  return (
    <Line>
      <LineCell className="w-64">
        <CapabilitySelect
          value={line.capability}
          vocabulary={vocabulary}
          disabled={readOnly}
          onChange={(capability) => onChange({ capability })}
        />
      </LineCell>
      <LineCell className="w-32">
        {metered && (
          <Input
            className="h-8 text-sm"
            value={line.unlimited ? "" : (line.quantity ?? "")}
            disabled={readOnly || line.unlimited}
            placeholder="25 or 100GB"
            onChange={(event) => onChange({ quantity: event.target.value || null })}
          />
        )}
      </LineCell>
      <LineCell className="w-32">
        {metered && (
          <Input
            className="h-8 text-sm"
            value={line.period ?? ""}
            disabled={readOnly || line.unlimited}
            placeholder="per month"
            onChange={(event) => onChange({ period: event.target.value || null })}
          />
        )}
      </LineCell>
      <LineCell className="w-24">
        {/* ⚠️ Turning this on CLEARS the amount rather than sitting beside it. A line carrying a number
            and "no ceiling" is a line whose two halves disagree, and the document it writes would parse
            into something nobody wrote. Unlimited is the absence of a ceiling, not a very large number:
            a tier sold as "unlimited users" that renders as 9,999,999 has lied to whoever pays for it. */}
        {metered && (
          <Switch
            checked={line.unlimited}
            disabled={readOnly}
            onCheckedChange={(unlimited) =>
              onChange({
                unlimited,
                quantity: unlimited ? null : line.quantity,
                period: unlimited ? null : line.period,
              })
            }
          />
        )}
      </LineCell>
      <RemoveCell readOnly={readOnly} onRemove={onRemove} />
    </Line>
  )
}
