import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Input, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Textarea } from "@jmouse/ui"
import { formsApi } from "@/api/forms"
import { CATALOGUED_CONFIG_KEYS, FORM_CONFIG_GROUPS } from "@/lib/formConfigCatalogue"
import { parseKeyValueLines, serializeKeyValueLines } from "@/lib/keyValueLines"
import { useMonitoringModule } from "@/hooks/useMonitoring"
import type { FormAudience, FormDetail, FormStatus } from "@/types"
import { ConfigControl } from "./ConfigControl"
import { MetricsSection } from "./sections/MetricsSection"
import { PlansSection } from "./sections/PlansSection"
import { WidgetsSection } from "./sections/WidgetsSection"
import { EditorField, EditorSection } from "./EditorSection"

/**
 * The form's own settings — what it is called, who may open it, and every configuration key it carries.
 *
 * ⚠️ **A sheet rather than a third pane** (Ivan, 2026-08-19): read rarely, edited rarely, and a
 * permanent column for them would take width from the two things somebody is actually working in.
 *
 * ⚠️ **Typed controls and the raw editor are one map.** Same rule as the field editor: a picker writes
 * the map, the textarea renders the map, and there is no second copy to fall out of step. The raw box
 * stays because it is the only way to set a key this catalogue has never heard of.
 *
 * ⚠️ **`PUT /forms/{id}/config` REPLACES the whole map** — "upserts what is given, deletes the rest".
 * That is why removing a key here is expressed by dropping it from the map rather than by a delete call,
 * and why the raw editor must always show every key: anything missing from it is about to be deleted.
 */
const STATUSES: FormStatus[] = ["ACTIVE", "INACTIVE", "DELETED"]

const AUDIENCES: Array<{ value: FormAudience; hint: string }> = [
  { value: "MEMBERS", hint: "people in the workspace" },
  { value: "EVERYONE", hint: "anybody with the link" },
  { value: "STAFF", hint: "staff only" },
]

export function FormSettingsSheet({
  form,
  open,
  onClose,
}: {
  form: FormDetail
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const watchesEquipment = useMonitoringModule()

  const [name, setName] = useState(form.name)
  const [codename, setCodename] = useState(form.codename ?? "")
  const [icon, setIcon] = useState(form.icon ?? "")
  const [description, setDescription] = useState(form.description ?? "")
  const [status, setStatus] = useState<FormStatus>(form.status)
  const [audience, setAudience] = useState<FormAudience>(form.audience)
  const [config, setConfig] = useState<Record<string, string>>(form.config ?? {})

  // Reseeded when the sheet opens, never while it is open — a refetch behind it would otherwise
  // overwrite what somebody is typing.
  useEffect(() => {
    if (!open) {
      return
    }

    setName(form.name)
    setCodename(form.codename ?? "")
    setIcon(form.icon ?? "")
    setDescription(form.description ?? "")
    setStatus(form.status)
    setAudience(form.audience)
    setConfig(form.config ?? {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function setConfigValue(key: string, value: string) {
    setConfig((previous) => {
      const next = { ...previous }

      if (value.trim()) {
        next[key] = value
      } else {
        delete next[key]
      }

      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      await formsApi.update(form.id, { name, codename, icon, description, status, audience })
      await formsApi.replaceConfig(form.id, config)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forms", form.id] })
      onClose()
    },
  })

  const uncatalogued = Object.keys(config).filter((key) => !CATALOGUED_CONFIG_KEYS.has(key))

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">Form settings</SheetTitle>
          <SheetDescription className="text-xs">What the form is called, and how it behaves.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <EditorSection title="Identity">
            <div className="grid grid-cols-[4rem_1fr] gap-2">
              <EditorField label="Icon">
                <Input
                  className="text-center"
                  maxLength={4}
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                />
              </EditorField>
              <EditorField label="Name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </EditorField>
            </div>

            <EditorField
              label="Codename"
              hint="How other things address this form. Changing it breaks those references."
            >
              <Input className="font-mono" value={codename} onChange={(event) => setCodename(event.target.value)} />
            </EditorField>

            <EditorField label="Description">
              <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            </EditorField>
          </EditorSection>

          <EditorSection title="Reach">
            <EditorField label="Status">
              <select
                className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
                value={status}
                onChange={(event) => setStatus(event.target.value as FormStatus)}
              >
                {STATUSES.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate.toLowerCase()}
                  </option>
                ))}
              </select>
            </EditorField>

            <EditorField label="Audience" hint={AUDIENCES.find((entry) => entry.value === audience)?.hint}>
              <select
                className="h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs"
                value={audience}
                onChange={(event) => setAudience(event.target.value as FormAudience)}
              >
                {AUDIENCES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.value.toLowerCase()}
                  </option>
                ))}
              </select>
            </EditorField>
          </EditorSection>

          {/* ⚠️ Between the form's own settings and its configuration keys, because that is what a widget
              is: neither identity nor a key, but a second thing the form carries. */}
          <WidgetsSection form={form} />

          {/* ⚠️ Only where the workspace watches its things AND this form is what describes them.
              Metrics on a holder form or a feedback form would be a heading nobody could fill in, and
              the module is paid — absent rather than disabled is the rule the labels module already
              sets. */}
          {watchesEquipment && form.purpose?.code === "ASSET" && (
            <>
              <MetricsSection form={form} />
              {/* ⚠️ After the metrics and never before them: a rule names one, so a plan editor
                  offered first would be a picker with nothing in it. */}
              <PlansSection form={form} />

              {/* ⚠️ **Both panels are also a screen of their own now** — `Watch`, in the sidebar, which
                  is where somebody who has not opened this form goes looking. They stay here as well
                  rather than moving out, because whoever is editing an asset form is exactly who thinks
                  of a metric, and this is where they are standing. */}
              <WatchElsewhereNote />
            </>
          )}

          {FORM_CONFIG_GROUPS.map((group) => {
            const setCount = group.entries.filter((entry) => config[entry.key]).length

            return (
              <EditorSection
                key={group.title}
                title={group.title}
                hint={group.hint}
                badge={setCount || undefined}
                // Only what has been set opens by itself; the rest is one click away and out of the way.
                defaultOpen={setCount > 0}
              >
                {group.entries.map((entry) => (
                  <EditorField key={entry.key} label={entry.label} hint={entry.hint}>
                    <ConfigControl
                      entry={entry}
                      value={config[entry.key] ?? ""}
                      fields={form.fields}
                      onChange={(value) => setConfigValue(entry.key, value)}
                    />
                  </EditorField>
                ))}
              </EditorSection>
            )
          })}

          <EditorSection title="Every key" badge={Object.keys(config).length || undefined} defaultOpen={false}>
            <EditorField
              label="Raw configuration"
              hint="key=value, one per line — the same map the controls above write. ⚠️ Anything missing from here is deleted on save."
            >
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={serializeKeyValueLines(config)}
                onChange={(event) => setConfig(parseKeyValueLines(event.target.value))}
              />
            </EditorField>

            {uncatalogued.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {uncatalogued.length} key{uncatalogued.length === 1 ? "" : "s"} here has no control of its own:{" "}
                <span className="font-mono">{uncatalogued.join(", ")}</span>
              </span>
            )}
          </EditorSection>
        </div>

        <footer className="flex items-center gap-2 border-t px-4 py-2.5">
          {save.isError && <span className="text-xs text-destructive">Could not save.</span>}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Where else the two panels above live.
 *
 * ⚠️ **A note rather than a link, deliberately.** The address of a workspace section is built from the
 * workspace slug, and this sheet is opened from screens that hold a form rather than a workspace — so a
 * link here would need a second way of knowing where it is standing. The sentence is what the panels
 * were missing: not a route, but the knowledge that they are reachable without opening a form at all.
 */
function WatchElsewhereNote() {
  return (
    <p className="border-b px-4 py-3 text-xs text-muted-foreground last:border-b-0">
      Everything above is also on the <strong>Watch</strong> screen in the sidebar, for every kind of
      thing at once — which is where to go when you are not already in a form.
    </p>
  )
}
