import { ConfigControl } from "@/components/form/builder/ConfigControl"
import type { ConfigEntry, ConfigGroup } from "@/lib/formConfigCatalogue"
import type { FieldDetail } from "@/types"
import { Pane, PaneField, PaneGrid } from "./Pane"

/**
 * One group of configuration keys, drawn from the catalogue.
 *
 * ⚠️ **The catalogue decides what is here, not this file.** A new key is one row in
 * `formConfigCatalogue.ts` and it arrives with a control — which is the whole reason the old
 * 557-line panel was replaced, half of whose keys never got one.
 *
 * ⚠️ **A `fields` picker and a long text take the whole row; everything else pairs up.** Forty chips in
 * a half-column wrap into six lines and stop being a picker, and two selects side by side is what makes
 * this compact enough to have no scrollbar at all on most groups.
 */
export function ConfigurationPane({
  group,
  fields,
  config,
  onChange,
}: {
  group: ConfigGroup
  fields: FieldDetail[]
  config: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <Pane title={group.title} hint={group.hint}>
      <PaneGrid>
        {group.entries.map((entry) => (
          <PaneField key={entry.key} label={entry.label} hint={entry.hint} wide={isWide(entry)}>
            {/* ⚠️ A chip list is boxed and scrolls at ten rows. A form with forty fields would
                otherwise make this pane taller than the window and push Save off the bottom. */}
            {entry.control.kind === "fields" ? (
              <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2">
                <ConfigControl
                  entry={entry}
                  value={config[entry.key] ?? ""}
                  fields={fields}
                  onChange={(value) => onChange(entry.key, value)}
                />
              </div>
            ) : (
              <ConfigControl
                entry={entry}
                value={config[entry.key] ?? ""}
                fields={fields}
                onChange={(value) => onChange(entry.key, value)}
              />
            )}
          </PaneField>
        ))}
      </PaneGrid>
    </Pane>
  )
}

function isWide(entry: ConfigEntry): boolean {
  return entry.control.kind === "fields" || (entry.control.kind === "text" && !!entry.control.long)
}

/** How many of a group's keys are set — the number the rail carries beside its name. */
export function setCountOf(group: ConfigGroup, config: Record<string, string>): number {
  return group.entries.filter((entry) => config[entry.key]).length
}
