import { Badge, Input, Switch, TableCell, TableRow } from "@jmouse/ui"
import type { PolicyCapabilityView } from "@/api/policy"
import {
  EditorField,
  EditorGrid,
  MonoBadge,
  OpenCell,
  PlainSelect,
  PolicyEditorDialog,
  PolicySection,
  RowMuted,
  applyToList,
  removeFromList,
  useSectionEditing,
} from "./PolicyEditingKit"

const BLANK_CAPABILITY: PolicyCapabilityView = {
  key: "",
  displayName: "",
  kind: "gate",
  scopes: [],
  paid: true,
}

/**
 * What a tier is *allowed to contain*.
 *
 * ⚠️ **Declaring only what a tier could contain is not an oversight.** This block holds everything
 * **paid** and everything **metered**, and no free module. A free module is not something anybody
 * *gets* — it is simply there, and no tier will ever name it. Listing all of them would put that list in
 * a second place, one commit behind the code that derives it, and edited by every feature. The boot
 * refuses a disagreement in *both* directions, so what belongs here is not a matter of taste.
 */
export function PolicyCapabilitiesPane({
  capabilities,
  readOnly,
  onChange,
}: {
  capabilities: PolicyCapabilityView[]
  readOnly: boolean
  onChange: (next: PolicyCapabilityView[]) => void
}) {
  const { editing, open, close } = useSectionEditing<PolicyCapabilityView>()

  return (
    <>
      <PolicySection
        label="Capabilities — what a tier may contain"
        addLabel="Add capability"
        readOnly={readOnly}
        onAdd={() => open(null, BLANK_CAPABILITY)}
        columns={["Key", "Called", "Shape", "Closed?"]}
        count={capabilities.length}
        empty={{
          glyph: "◆",
          title: "Nothing declared here",
          message:
            "Only what a tier could contain belongs in this block — everything paid and everything counted. A free module is simply there and is derived from the code.",
        }}
      >
        {capabilities.map((capability, index) => (
          <TableRow key={index}>
            <TableCell>
              <MonoBadge>{capability.key || "unnamed"}</MonoBadge>
            </TableCell>
            <TableCell>{capability.displayName || <RowMuted>—</RowMuted>}</TableCell>
            <TableCell>
              <Badge variant="outline">{capability.kind}</Badge>
            </TableCell>
            <TableCell>{capability.paid ? <Badge>paid</Badge> : <RowMuted>free</RowMuted>}</TableCell>
            <OpenCell readOnly={readOnly} onOpen={() => open(index, capability)} />
          </TableRow>
        ))}
      </PolicySection>

      {editing && (
        <PolicyEditorDialog
          key={editing.index ?? "new"}
          title={editing.index === null ? "New capability" : `Capability · ${editing.initial.key}`}
          description="What a tier may contain — never how much of it. The amount belongs to the tier's own line."
          initial={editing.initial}
          readOnly={readOnly}
          width="sm:max-w-xl"
          onClose={close}
          onApply={(next) => onChange(applyToList(capabilities, editing.index, next))}
          onRemove={editing.index === null ? undefined : () => onChange(removeFromList(capabilities, editing.index!))}
        >
          {(draft, setDraft) => <CapabilityEditor capability={draft} readOnly={readOnly} onChange={setDraft} />}
        </PolicyEditorDialog>
      )}
    </>
  )
}

function CapabilityEditor({
  capability,
  readOnly,
  onChange,
}: {
  capability: PolicyCapabilityView
  readOnly: boolean
  onChange: (next: PolicyCapabilityView) => void
}) {
  return (
    <EditorGrid>
      <EditorField label="Key" hint="What the code asks for. Changing it renames a capability nothing grants any more.">
        <Input
          className="h-8 font-mono text-sm"
          value={capability.key}
          disabled={readOnly}
          placeholder="storage-byte"
          onChange={(event) => onChange({ ...capability, key: event.target.value })}
        />
      </EditorField>

      <EditorField label="Called" hint="What a customer reads on every screen this appears on.">
        <Input
          className="h-8 text-sm"
          value={capability.displayName ?? ""}
          disabled={readOnly}
          placeholder="Storage written"
          onChange={(event) => onChange({ ...capability, displayName: event.target.value })}
        />
      </EditorField>

      {/* ⚠️ limit and quota are different machinery rather than one with a flag, and the choice here is
          the one that decides which. A LIMIT is counted from what EXISTS — delete a workspace and the
          number is right again, with nothing to decrement. A QUOTA is consumption over a window, and
          nothing existing can be recounted to find it. */}
      <EditorField label="Shape">
        <PlainSelect
          value={capability.kind}
          disabled={readOnly}
          onChange={(kind) => onChange({ ...capability, kind })}
        >
          <option value="gate">gate — a slice of the product</option>
          <option value="limit">limit — how many may exist</option>
          <option value="quota">quota — how much may be used, per period</option>
        </PlainSelect>
      </EditorField>

      {/* The one boolean that decides whether an absence reads as "free" or as "your plan does not
          include this". */}
      <EditorField label="Paid" hint="Closed until something grants it. Free capabilities are simply there.">
        <span className="flex h-8 items-center">
          <Switch
            checked={capability.paid}
            disabled={readOnly}
            onCheckedChange={(paid) => onChange({ ...capability, paid })}
          />
        </span>
      </EditorField>
    </EditorGrid>
  )
}
