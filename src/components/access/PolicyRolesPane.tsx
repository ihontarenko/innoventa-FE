import { Badge, Input, TableCell, TableRow } from "@jmouse/ui"
import type { PolicyBundleEntryView, PolicyRoleView, PolicyVocabularyView } from "@/api/policy"
import {
  ChipRow,
  MonoBadge,
  OpenCell,
  PermissionChecklist,
  PolicyEditorDialog,
  PolicySection,
  RowMuted,
  ScopeChips,
  applyToList,
  removeFromList,
  useSectionEditing,
} from "./PolicyEditingKit"

const BLANK_ROLE: PolicyRoleView = { name: "", bundle: [] }

/**
 * The bundles — what a role carries, and how far.
 *
 * ⚠️ **The refusals a role carries are enforced here, not only on save.** A role body may hold no
 * instance, no effect and no condition. That is the language's sharpest rule and the one whose failure
 * is a privilege escalation: `@SPACE space:write` inside a role means "as far as a workspace", and which
 * workspace is decided by where the role is assigned — the same line in a subject would grant it in
 * *every* workspace at once. So the editor offers a scope kind and a permission, and nothing else. **The
 * form must not be able to compose the escalation the parser exists to refuse.**
 */
export function PolicyRolesPane({
  roles,
  vocabulary,
  readOnly,
  onChange,
}: {
  roles: PolicyRoleView[]
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyRoleView[]) => void
}) {
  const { editing, open, close } = useSectionEditing<PolicyRoleView>()

  return (
    <>
      <PolicySection
        label="Roles — what a bundle carries, and how far"
        addLabel="Add role"
        readOnly={readOnly}
        onAdd={() => open(null, BLANK_ROLE)}
        columns={["Role", "Carries", "As far as"]}
        count={roles.length}
        empty={{
          glyph: "◇",
          title: "No roles here",
          message: "A role declared here is a bundle everybody holding that role carries, everywhere.",
        }}
      >
        {roles.map((role, index) => (
          <TableRow key={index}>
            <TableCell>
              <MonoBadge>{role.name || "unnamed"}</MonoBadge>
            </TableCell>
            <TableCell>
              {role.bundle.length === 0 ? (
                <RowMuted>nothing</RowMuted>
              ) : (
                <NamespaceSummary names={role.bundle.map((entry) => entry.permission)} />
              )}
            </TableCell>
            <TableCell>
              <ScopeChips scopes={role.bundle.map((entry) => entry.scope)} />
            </TableCell>
            <OpenCell readOnly={readOnly} onOpen={() => open(index, role)} />
          </TableRow>
        ))}
      </PolicySection>

      {editing && (
        <PolicyEditorDialog
          key={editing.index ?? "new"}
          title={editing.index === null ? "New role" : `Role · ${editing.initial.name}`}
          description="A role states a kind of place, never which one — where it reaches is decided by where it is assigned."
          initial={editing.initial}
          readOnly={readOnly}
          width="sm:max-w-4xl"
          onClose={close}
          onApply={(next) => onChange(applyToList(roles, editing.index, next))}
          onRemove={editing.index === null ? undefined : () => onChange(removeFromList(roles, editing.index!))}
        >
          {(draft, setDraft) => (
            <RoleEditor role={draft} vocabulary={vocabulary} readOnly={readOnly} onChange={setDraft} />
          )}
        </PolicyEditorDialog>
      )}
    </>
  )
}

function RoleEditor({
  role,
  vocabulary,
  readOnly,
  onChange,
}: {
  role: PolicyRoleView
  vocabulary?: PolicyVocabularyView
  readOnly: boolean
  onChange: (next: PolicyRoleView) => void
}) {
  function replaceBundle(bundle: PolicyBundleEntryView[]) {
    onChange({ ...role, bundle })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-64 font-mono text-sm"
          value={role.name}
          disabled={readOnly}
          placeholder="SPACE_ADMIN"
          onChange={(event) => onChange({ ...role, name: event.target.value })}
        />
        <Badge variant="secondary" className="font-mono">
          {role.bundle.length} permission(s)
        </Badge>
      </div>

      {/* ⚠️ The whole catalogue as thin rows — not a row per carried permission with a dropdown in it.
          The question this editor exists to answer is *what does this role carry*, and a column of
          collapsed selects answered it only for somebody willing to open fifty of them. No instance
          picker here, deliberately: a bundle entry states a KIND of place. */}
      <PermissionChecklist bundle={role.bundle} vocabulary={vocabulary} disabled={readOnly} onChange={replaceBundle} />
    </>
  )
}

/**
 * What a bundle is *about*, as its namespaces rather than as its forty names.
 *
 * A row exists to answer *is this the one I want*, and `form entry file page` answers it in one glance
 * where `form:read form:write form:delete form:share …` answers it after a paragraph.
 */
function NamespaceSummary({ names }: { names: string[] }) {
  const namespaces = [...new Set(names.map((name) => name.split(":")[0]))].sort()
  const shown = namespaces.slice(0, 6)
  const hidden = namespaces.length - shown.length

  return (
    <ChipRow title={names.join("\n")}>
      {shown.map((namespace) => (
        <MonoBadge key={namespace}>{namespace}</MonoBadge>
      ))}
      {hidden > 0 && <Badge variant="outline">+{hidden} more</Badge>}
    </ChipRow>
  )
}
