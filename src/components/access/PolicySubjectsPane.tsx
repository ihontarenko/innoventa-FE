import { Badge, TableCell, TableRow } from "@jmouse/ui"
import type { PolicyAssignmentView, PolicyGrantView, PolicySubjectView, PolicyVocabularyView } from "@/api/policy"
import { PolicyConditionField } from "./PolicyConditionField"
import { InstanceName, InstancePicker } from "./PolicyInstancePicker"
import {
  ChipRow,
  Line,
  LineCell,
  LineTable,
  MonoBadge,
  OpenCell,
  PermissionSelect,
  PlainSelect,
  PolicyEditorDialog,
  PolicySection,
  RemoveCell,
  RowMuted,
  ScopePicker,
  applyToList,
  removeFromList,
  useSectionEditing,
} from "./PolicyEditingKit"

const BLANK_SUBJECT: PolicySubjectView = { id: "", roles: [], grants: [] }

/** What one account holds, and where. */
export function PolicySubjectsPane({
  subjects,
  vocabulary,
  readOnly,
  onChange,
}: {
  subjects: PolicySubjectView[]
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicySubjectView[]) => void
}) {
  const { editing, open, close } = useSectionEditing<PolicySubjectView>()

  return (
    <>
      <PolicySection
        label="Subjects — what one account holds, and where"
        addLabel="Add subject"
        readOnly={readOnly}
        onAdd={() => open(null, BLANK_SUBJECT)}
        columns={["Account", "Roles", "Personal grants"]}
        count={subjects.length}
        empty={{
          glyph: "◎",
          title: "No subjects here",
          message: "Handing one power to one person is an assignment, not a policy edit — /admin does that.",
        }}
      >
        {subjects.map((subject, index) => {
          const denials = subject.grants.filter((grant) => grant.effect === "DENY").length

          return (
            <TableRow key={index}>
              <TableCell>
                {/* The identifier is what the file carries; the name is what makes the row readable.
                    Both, because either alone misleads. */}
                <InstanceName kind="SUBJECT" id={subject.id} />
              </TableCell>
              <TableCell>
                {subject.roles.length === 0 ? (
                  <RowMuted>none</RowMuted>
                ) : (
                  <ChipRow>
                    {subject.roles.map((assignment, at) => (
                      <MonoBadge key={at}>{describeAssignment(assignment)}</MonoBadge>
                    ))}
                  </ChipRow>
                )}
              </TableCell>
              <TableCell>
                {subject.grants.length === 0 ? (
                  <RowMuted>none</RowMuted>
                ) : (
                  <ChipRow>
                    <MonoBadge>{subject.grants.length} grant(s)</MonoBadge>
                    {/* ⚠️ Called out rather than counted in: a denial wins over every allow anywhere,
                        so a row that hides one among its grants hides the reason for the answer. */}
                    {denials > 0 && <MonoBadge variant="destructive">{denials} deny</MonoBadge>}
                  </ChipRow>
                )}
              </TableCell>
              <OpenCell readOnly={readOnly} onOpen={() => open(index, subject)} />
            </TableRow>
          )
        })}
      </PolicySection>

      {editing && (
        <PolicyEditorDialog
          key={editing.index ?? "new"}
          title={editing.index === null ? "New subject" : "Subject"}
          description="What this one account carries by name — beside, never instead of, what its roles confer."
          initial={editing.initial}
          readOnly={readOnly}
          width="sm:max-w-4xl"
          onClose={close}
          onApply={(next) => onChange(applyToList(subjects, editing.index, next))}
          onRemove={editing.index === null ? undefined : () => onChange(removeFromList(subjects, editing.index!))}
        >
          {(draft, setDraft) => (
            <SubjectEditor subject={draft} vocabulary={vocabulary} readOnly={readOnly} onChange={setDraft} />
          )}
        </PolicyEditorDialog>
      )}
    </>
  )
}

/** `SPACE_ADMIN @SPACE:sp_kyiv` — the assignment as the file writes it. */
function describeAssignment(assignment: PolicyAssignmentView): string {
  return assignment.instance
    ? `${assignment.roleName} @${assignment.scope}:${assignment.instance}`
    : `${assignment.roleName} @${assignment.scope}`
}

/**
 * One account's roles and personal grants, as two tables of thin rows.
 *
 * ⚠️ **Two kinds of line, so two tables.** A role is a bundle somebody carries; a grant is one
 * permission handed over or taken away. Stacked as one column of bordered cards they read as the same
 * thing said twice — and the four controls a grant carries wrapped onto a second line, at which point
 * nothing on screen said where one line ended and the next began.
 */
function SubjectEditor({
  subject,
  vocabulary,
  readOnly,
  onChange,
}: {
  subject: PolicySubjectView
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicySubjectView) => void
}) {
  function replaceGrants(grants: PolicyGrantView[]) {
    onChange({ ...subject, grants })
  }

  function editAssignment(at: number, next: Partial<PolicyAssignmentView>) {
    onChange({
      ...subject,
      roles: subject.roles.map((candidate, index) => (index === at ? { ...candidate, ...next } : candidate)),
    })
  }

  function editGrant(at: number, next: Partial<PolicyGrantView>) {
    replaceGrants(subject.grants.map((candidate, index) => (index === at ? { ...candidate, ...next } : candidate)))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* ⚠️ Who this is about, chosen rather than typed. The identifier is what the file carries and
            nobody knows one by heart — a free-text box here is a box people fill by pasting, and a
            pasted identifier one character out is a grant handed quietly to nobody, or to somebody
            else. */}
        <div className="min-w-64 flex-1">
          <InstancePicker
            kind="SUBJECT"
            value={subject.id}
            disabled={readOnly}
            placeholder="which account?"
            onChange={(id) => onChange({ ...subject, id })}
          />
        </div>
        <Badge variant="secondary" className="font-mono">
          {subject.roles.length} assignment(s) · {subject.grants.length} grant(s)
        </Badge>
      </div>

      <LineTable
        heading="Roles"
        columns={["Role", "Where"]}
        count={subject.roles.length}
        quiet="This account carries no role. A role is the ordinary way to hold anything."
        addLabel={readOnly ? undefined : "Assign a role"}
        onAdd={() =>
          onChange({
            ...subject,
            roles: [
              ...subject.roles,
              { roleName: vocabulary?.roles[0] ?? "", scope: "GLOBAL", instance: null },
            ],
          })
        }
      >
        {subject.roles.map((assignment, at) => (
          <Line key={`role-${at}`}>
            <LineCell className="w-56">
              <PlainSelect
                value={assignment.roleName}
                disabled={readOnly}
                className="font-mono text-xs"
                onChange={(roleName) => editAssignment(at, { roleName })}
              >
                {(vocabulary?.roles ?? []).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </PlainSelect>
            </LineCell>
            <LineCell>
              <ScopePicker
                scope={assignment.scope}
                instance={assignment.instance}
                vocabulary={vocabulary}
                disabled={readOnly}
                onChange={(scope, instance) => editAssignment(at, { scope, instance })}
              />
            </LineCell>
            <RemoveCell
              readOnly={readOnly}
              onRemove={() => onChange({ ...subject, roles: removeFromList(subject.roles, at) })}
            />
          </Line>
        ))}
      </LineTable>

      <LineTable
        heading="Personal grants"
        columns={["Permission", "Where", "Effect", "When"]}
        count={subject.grants.length}
        quiet="Nothing is granted or denied to this account by name."
        addLabel={readOnly ? undefined : "Add a personal grant"}
        onAdd={() =>
          replaceGrants([
            ...subject.grants,
            {
              permission: vocabulary?.permissions[0]?.name ?? "",
              scope: "GLOBAL",
              instance: null,
              effect: "ALLOW",
              condition: null,
            },
          ])
        }
      >
        {subject.grants.map((grant, at) => (
          <Line key={`grant-${at}`} denial={grant.effect === "DENY"}>
            {/* ⚠️ The select and nothing beside it. A badge sat here too, saying the same permission
                the select's own value says — so the cell was two lines tall where every other cell in
                the row is one, and nothing lined up with anything else. */}
            <LineCell className="w-56">
              <PermissionSelect
                value={grant.permission}
                vocabulary={vocabulary}
                disabled={readOnly}
                onChange={(permission) => editGrant(at, { permission })}
              />
            </LineCell>
            <LineCell>
              <ScopePicker
                scope={grant.scope}
                instance={grant.instance}
                vocabulary={vocabulary}
                disabled={readOnly}
                onChange={(scope, instance) => editGrant(at, { scope, instance })}
              />
            </LineCell>
            <LineCell className="w-32">
              {/* Deny is not "the other option" — it wins over every allow, everywhere, so the row it
                  sits in carries the weight rather than the control alone. */}
              <PlainSelect
                value={grant.effect}
                disabled={readOnly}
                onChange={(effect) => editGrant(at, { effect: effect as PolicyGrantView["effect"] })}
              >
                <option value="ALLOW">allow</option>
                <option value="DENY">deny — wins</option>
              </PlainSelect>
            </LineCell>
            <LineCell className="w-60">
              <PolicyConditionField
                condition={grant.condition}
                vocabulary={vocabulary}
                disabled={readOnly}
                onChange={(condition) => editGrant(at, { condition })}
              />
            </LineCell>
            <RemoveCell readOnly={readOnly} onRemove={() => replaceGrants(removeFromList(subject.grants, at))} />
          </Line>
        ))}
      </LineTable>
    </>
  )
}
