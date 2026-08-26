import { parseKeyValueLines, serializeKeyValueLines } from "@/lib/keyValueLines"
import { Input, Textarea } from "@jmouse/ui"
import { HAS_PLACEHOLDER, HAS_UNIT } from "@/lib/fieldTypes"
import { FIELD_CONFIG_KEYS } from "@/lib/fieldConfigs"
import { TagEditor } from "@/components/TagEditor"
import { EditorField, EditorSection } from "../EditorSection"
import type { FieldDraft, useFieldDraft } from "../useFieldDraft"

/**
 * The keys nothing else has a control for — and the two maps behind everything.
 *
 * ⚠️ **The typed controls above and the raw maps below are the SAME state.** In the old editor
 * `placeholder` and `style` were separate strings synchronised into a textarea by hand; here setting
 * one writes the map, and the textarea renders the map. There is no second copy to drift.
 *
 * ⚠️ **The raw editors stay** (Ivan, 2026-08-19). They are how a provider's parameters and any key
 * without a control get set at all, and removing them would make the product less capable than the one
 * being replaced.
 */
export function AdvancedSection({
  editor,
  fieldId,
}: {
  editor: ReturnType<typeof useFieldDraft>
  /** The field being edited, so its tags can be set here. Tags write immediately, outside the draft. */
  fieldId: string
}) {
  const { draft, update, setAttribute, setConfig } = editor

  const attributeCount = Object.keys(draft.attributes).length
  const configCount = Object.keys(draft.configs).length

  return (
    <EditorSection title="Advanced" icon="⚙" badge={attributeCount + configCount || undefined} defaultOpen={false}>
      {/* ⚠️ Outside the draft, and the hint says so. A tag writes the moment it is added — it is a
          relationship between two rows rather than a column on this field, so a Revert here could not
          take one back off. Same rule as a group's children. */}
      <EditorField label="Tags" hint="Saved as you add them — the Save button below does not cover these.">
        <TagEditor entityId={fieldId} entityKind="FIELD" />
      </EditorField>

      {HAS_UNIT.has(draft.elementType) && (
        <EditorField label="Unit" hint="Several, comma-separated, become the unit picker of a quantity.">
          <Input
            className="font-mono"
            placeholder="V, A, Ω, nF…"
            value={draft.unit}
            onChange={(event) => update({ unit: event.target.value })}
          />
        </EditorField>
      )}

      {HAS_PLACEHOLDER.has(draft.elementType) && (
        <EditorField label="Placeholder" hint="Shown inside the control as a hint.">
          <Input
            value={draft.attributes["placeholder"] ?? ""}
            onChange={(event) => setAttribute("placeholder", event.target.value)}
          />
        </EditorField>
      )}

      <EditorField label="Help line" hint="Sits under the control on the form.">
        <Input
          value={draft.configs[FIELD_CONFIG_KEYS.DISPLAY_HINT] ?? ""}
          onChange={(event) => setConfig(FIELD_CONFIG_KEYS.DISPLAY_HINT, event.target.value)}
        />
      </EditorField>

      <EditorField label="Custom style">
        <Input
          className="font-mono text-xs"
          placeholder="color: red; font-weight: bold"
          value={draft.attributes["style"] ?? ""}
          onChange={(event) => setAttribute("style", event.target.value)}
        />
      </EditorField>

      <RawMapField
        label="Attributes"
        hint="key=value, one per line. Everything above writes into this same map."
        map={draft.attributes}
        onChange={(attributes) => update({ attributes })}
      />

      <RawMapField
        label="Configuration"
        hint="key=value, one per line — including a provider's own parameters."
        map={draft.configs}
        onChange={(configs) => update({ configs })}
      />
    </EditorSection>
  )
}

function RawMapField({
  label,
  hint,
  map,
  onChange,
}: {
  label: string
  hint: string
  map: FieldDraft["attributes"]
  onChange: (map: Record<string, string>) => void
}) {
  return (
    <EditorField label={label} hint={hint}>
      <Textarea
        rows={3}
        className="font-mono text-xs"
        value={serializeKeyValueLines(map)}
        onChange={(event) => onChange(parseKeyValueLines(event.target.value))}
      />
    </EditorField>
  )
}
