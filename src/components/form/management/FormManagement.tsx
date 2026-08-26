import { useState } from "react"
import { Button, Skeleton, cn } from "@jmouse/ui"
import { RawConfigDialog } from "@/components/form/RawConfigDialog"
import { MetricsSection } from "@/components/form/builder/sections/MetricsSection"
import { PlansSection } from "@/components/form/builder/sections/PlansSection"
import { WidgetsSection } from "@/components/form/builder/sections/WidgetsSection"
import { FORM_CONFIG_GROUPS } from "@/lib/formConfigCatalogue"
import { useMonitoringModule } from "@/hooks/useMonitoring"
import { useSubmissionPolicy } from "@/hooks/useWorkspaceForms"
import { ConfigurationPane, setCountOf } from "./ConfigurationPane"
import { IdentityPane } from "./IdentityPane"
import { Pane } from "./Pane"
import { PlacementPane } from "./PlacementPane"
import { ReachPane } from "./ReachPane"
import { SubmissionsPane } from "./SubmissionsPane"
import { useFormConfiguration } from "./useFormConfiguration"
import { useFormIdentity } from "./useFormIdentity"
import type { ManagedForm } from "./types"

/**
 * Which level the screen that opened this is standing on — the levels rule, as one argument.
 *
 * ⚠️ **This is `LevelDoor` (`INVT-0076`) expressed as data rather than as copies of a screen.** The
 * same panes serve every caller, and what differs is only which configuration a caller has any business
 * showing:
 *
 * | Depth | Where | Configuration shown |
 * |---|---|---|
 * | `base` | the **form library**, the **schema builder**, and a form's own manage page | the `form`-scoped groups only: what an entry is called, what the button says, how a value is validated — plus the widgets it carries, which are the form engine's own |
 * | `domain` | **component types**, and any other screen a subject area contributes | the above **plus** that area's own groups (`stock.*`, `pricing.*`) and, for an asset form, its metrics and plans |
 *
 * ⚠️ **The BUILDER is `base`, and getting that wrong is the bug this table exists to prevent** (Ivan,
 * 2026-08-25: *«форм лібрарі не має знати ні про які прайси. це порушення рівнів»*). It is tempting to
 * read the builder as the deepest place — it is one form, in one workspace, with everything to hand —
 * but it is reached *from the form library*, which is the platform's base and knows nothing about stock
 * or distributors. **The level belongs to the screen you came from, never to how much detail is
 * available.**
 *
 * ⚠️ So `stock.*` and `pricing.*` are editable in exactly one place: the Component types screen, which
 * is the level that owns them. Ivan: *«form library low level < component types highest level over form
 * library»*.
 */
export type ManagementDepth = "base" | "domain"

/**
 * Everything about a form that is not its schema — as a rail of answers rather than a scroll.
 *
 * ⚠️ **A rail, not an accordion** (Ivan, 2026-08-25). Stacked collapsibles made *is this form shared?*
 * cost two scrolls and a click, and every group somebody was not asking about still took their screen.
 * Here every pane is named at once down the left, **each carrying its own state as a badge** —
 * `Inventory`, `shared`, `unrestricted`, `4 set` — so the whole configuration is legible before anything
 * is opened, and the pane holds only the thing being changed.
 *
 * ⚠️ **This replaced the builder's settings SHEET as well** (Ivan, 2026-08-25: *«форм сетінги я просив
 * змінити і прибрати боковушку»*). There is one management surface now, at two levels; a sheet with the
 * same questions in a different shape was the second place for every one of them to drift — and it was
 * also where the levels rule was being broken, since it showed every configuration group there is.
 *
 * ⚠️ **One configuration draft across every configuration pane.** They are groups of keys in ONE map the
 * backend replaces wholesale — see `useFormConfiguration`.
 */
export function FormManagement({ form, depth = "base" }: { form: ManagedForm; depth?: ManagementDepth }) {
  const configuration = useFormConfiguration(form.id)
  const identity = useFormIdentity(form)
  const { data: policy } = useSubmissionPolicy(form.id)
  const watchesEquipment = useMonitoringModule()

  const [activePaneId, setActivePaneId] = useState("identity")
  const [isRawOpen, setRawOpen] = useState(false)
  const [shareToken, setShareToken] = useState(form.shareToken)
  const [isLimited, setLimited] = useState<boolean | null>(null)

  const detail = configuration.form
  const limited = isLimited ?? !!policy

  const groups = FORM_CONFIG_GROUPS.filter((group) => (depth === "base" ? group.scope === "form" : true))

  // ⚠️ Three things at once, and the first is the levels rule: metrics and plans belong to the subject
  // area that watches equipment, so a base-level screen must not offer them however much it knows. Then:
  // only where the workspace actually watches its things, and only on the form that describes one —
  // metrics on a holder form would be a heading nobody could fill in. The module is paid, so absent
  // rather than disabled, which is the rule the labels module already sets.
  const showsWatch = depth === "domain" && watchesEquipment && form.purpose?.code === "ASSET"

  const items: RailItem[] = [
    { id: "identity", glyph: "✦", label: "Identity", badge: form.codename ?? "unnamed" },
    { id: "placement", glyph: "▣", label: "Placement", badge: form.purpose?.label ?? "unfiled" },
    {
      id: "reach",
      glyph: "⇗",
      label: "Reach",
      badge: shareToken ? "shared" : identity.draft.status.toLowerCase(),
      isOn: !!shareToken,
    },
    { id: "submissions", glyph: "⛨", label: "Submissions", badge: limited ? "limited" : "open", isOn: limited },
    // ⚠️ Widgets are the form ENGINE's own — a visualiser bound to a field is true of any form whatever
    // a workspace counts — so they are not a level crossing and stay at base.
    { id: "widgets", glyph: "◈", label: "Widgets", badge: "bound" },
    ...(showsWatch ? [{ id: "watch", glyph: "◔", label: "Watch", badge: "metrics" }] : []),
    ...groups.map((group) => {
      const count = setCountOf(group, configuration.config)

      return {
        id: `configuration:${group.title}`,
        glyph: GROUP_GLYPHS[group.title] ?? "◍",
        label: group.title,
        badge: count ? `${count} set` : "default",
        isOn: count > 0,
      }
    }),
  ]

  const activeGroup = groups.find((group) => `configuration:${group.title}` === activePaneId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[12rem_minmax(0,1fr)]">
        {/* ⚠️ A scrolling strip of chips below `sm`, a column above it. Eight rail items stacked on a
            phone would be most of its height spent on navigation. */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0">
          {items.map((item) => (
            <RailButton
              key={item.id}
              item={item}
              isActive={activePaneId === item.id}
              onSelect={() => setActivePaneId(item.id)}
            />
          ))}
        </nav>

        <div className="min-h-0 overflow-y-auto p-4">
          {activePaneId === "identity" && <IdentityPane formId={form.id} identity={identity} />}
          {activePaneId === "placement" && <PlacementPane form={form} />}
          {activePaneId === "reach" && <ReachPane form={form} identity={identity} onShared={setShareToken} />}
          {activePaneId === "submissions" && <SubmissionsPane formId={form.id} onChanged={setLimited} />}

          {activePaneId === "widgets" &&
            (detail ? (
              <Pane title="Widgets" hint="What this form carries beside its fields, and which field feeds each one.">
                <WidgetsSection form={detail} />
              </Pane>
            ) : (
              <Skeleton className="h-48 w-full" />
            ))}

          {activePaneId === "watch" &&
            (detail ? (
              <Pane title="Watch" hint="What is measured on one of these, and what a plan expects of it.">
                <MetricsSection form={detail} />
                {/* ⚠️ After the metrics and never before them: a plan rule names one, so a plan editor
                    offered first would be a picker with nothing in it. */}
                <PlansSection form={detail} />
                <p className="text-xs text-muted-foreground">
                  Everything here is also on the <strong>Watch</strong> screen in the sidebar, for every
                  kind of thing at once — which is where to go when you are not already in a form.
                </p>
              </Pane>
            ) : (
              <Skeleton className="h-48 w-full" />
            ))}

          {activeGroup &&
            (detail ? (
              <ConfigurationPane
                group={activeGroup}
                fields={detail.fields}
                config={configuration.config}
                onChange={configuration.setValue}
              />
            ) : (
              <Skeleton className="h-48 w-full" />
            ))}
        </div>
      </div>

      {/* ⚠️ Present only on a configuration pane, because it is the only Save that spans panes. The
          others write to their own endpoints and carry their own buttons — one footer Save for all of
          them would be one button claiming to do five unrelated things. */}
      {activeGroup && (
        <footer className="flex shrink-0 items-center gap-2 border-t bg-background px-4 py-2.5">
          <Button variant="outline" size="sm" onClick={() => setRawOpen(true)}>
            Raw edit
          </Button>

          <span className={cn("ml-auto text-xs", configuration.isDirty ? "text-foreground" : "text-muted-foreground")}>
            {configuration.isSaving ? "Saving…" : configuration.isDirty ? "unsaved" : "saved"}
          </span>

          <Button size="sm" disabled={!configuration.isDirty || configuration.isSaving} onClick={configuration.save}>
            Save
          </Button>
        </footer>
      )}

      {isRawOpen && (
        <RawConfigDialog
          config={configuration.config}
          // ⚠️ Applied into the draft, not saved — the dialog edits what is on screen, and Save is still
          // the one thing that writes. Otherwise a paste would commit before anybody had read it.
          onApply={configuration.setConfig}
          onClose={() => setRawOpen(false)}
        />
      )}
    </div>
  )
}

/** The glyph each configuration group is known by in the rail. A group with none falls back to a dot. */
const GROUP_GLYPHS: Record<string, string> = {
  Display: "▤",
  Submitting: "⌸",
  Validation: "✓",
  Stock: "📦",
  Pricing: "₴",
}

interface RailItem {
  id: string
  glyph: string
  label: string
  /** The pane's state in one word — what makes the rail readable without opening anything. */
  badge: string
  isOn?: boolean
}

function RailButton({ item, isActive, onSelect }: { item: RailItem; isActive: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-current={isActive}
      onClick={onSelect}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors sm:w-full",
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <span aria-hidden="true" className="w-4 shrink-0 text-center text-xs opacity-70">
        {item.glyph}
      </span>
      <span className="shrink-0 truncate">{item.label}</span>
      {/* ⚠️ The badge shrinks and the LABEL does not, which is the opposite of the obvious default. A
          badge carrying a codename is longer than the word beside it, and `shrink-0` on it turned
          "Identity" into "Ide…" — the one word somebody navigates by. */}
      <span
        className={cn(
          "ml-auto hidden max-w-[45%] min-w-0 shrink truncate rounded-full px-1.5 py-0.5 text-[10px] leading-none sm:inline",
          item.isOn ? "bg-primary/15 text-primary" : "text-muted-foreground",
          isActive && "opacity-90",
        )}
      >
        {item.badge}
      </span>
    </button>
  )
}
