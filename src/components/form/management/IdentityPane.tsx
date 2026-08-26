import { Button, Input, Textarea } from "@jmouse/ui"
import { TagEditor } from "@/components/TagEditor"
import { Pane, PaneField, PaneGrid } from "./Pane"
import type { useFormIdentity } from "./useFormIdentity"

/**
 * What the form is called.
 *
 * ⚠️ **The codename is not the name, and changing it breaks things.** Other forms, expressions and
 * integrations address this form by it; the name is what people read. Both are editable, and only one
 * of them is dangerous — which is what the hint under it is for.
 *
 * ⚠️ **Tags live here, on identity rather than on placement.** A purpose and a category are *where the
 * form is filed*, decided from a fixed vocabulary; a tag is *what somebody calls it*, invented as they
 * go. Filing and naming are different acts, and the pane a reader opens for one is not the other.
 */
export function IdentityPane({
  formId,
  identity,
}: {
  formId: string
  identity: ReturnType<typeof useFormIdentity>
}) {
  const { draft, update, isDirty, isSaving, error, save } = identity

  return (
    <Pane title="Identity" hint="What the form is called, and how other things address it.">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
        <PaneField label="Icon">
          <Input
            className="text-center"
            maxLength={4}
            placeholder="◇"
            value={draft.icon}
            onChange={(event) => update({ icon: event.target.value })}
          />
        </PaneField>

        <PaneField label="Name">
          <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
        </PaneField>
      </div>

      <PaneGrid>
        <PaneField label="Codename" hint="⚠️ How other things address this form. Changing it breaks those references.">
          <Input
            className="font-mono"
            value={draft.codename}
            onChange={(event) => update({ codename: event.target.value })}
          />
        </PaneField>

        <PaneField label="Tags" hint="Saved as you add them — no Save needed for these.">
          <TagEditor entityId={formId} entityKind="FORM" />
        </PaneField>
      </PaneGrid>

      <PaneField label="Description" wide>
        <Textarea
          rows={2}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </PaneField>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!isDirty || isSaving} onClick={save}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </Pane>
  )
}
