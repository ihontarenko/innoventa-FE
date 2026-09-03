import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, cn, Input, Row, RowGroup, RowList, Skeleton, Switch } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { GroupDot } from "@/components/GroupDot"
import { PageHeader } from "@/components/PageHeader"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useBackendBuildInfo, useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const SYSTEM_SETTINGS = platformItem("system-settings")
import { groupHues } from "@/lib/groupHues"
import { relativeTime } from "@/lib/dates"
import type { SystemSetting } from "@/api/settings"

/**
 * The knobs that decide how the whole installation behaves.
 *
 * ⚠️ **The control is derived from the setting's `shape`, never from a list of keys here.** That is
 * what lets the list be one list: the old split — "Authentication" above, "Runtime configuration"
 * below — described where a setting was *rendered* rather than what it does, and existed only because
 * the switch decision was a hardcoded key list.
 *
 * <h3>⚠️ One line per setting, and the headings this file used to argue against</h3>
 *
 * This screen was a flat list of bordered cards, each two lines tall, and its own comments explained
 * both choices: cards because a description on a shared ground reads as a row of its own, and no
 * headings because *"section headings over ten namespaces, six of which hold one setting each, would
 * cost more room than the grouping saves"*.
 *
 * Both were right about the layout they described and both are gone, because the second line is. A
 * setting is a key, a sentence and a control — three short things that fit on one line, with the
 * sentence taking the space the control does not. Once nothing sits *under* a row, the reason for
 * giving each one its own border goes with it, and hairline-separated rows halve the height.
 *
 * The headings came back for a different reason than the one that was refused: they are grouped by
 * **family** rather than by namespace, so there are far fewer of them — and each one earns its own
 * height back immediately, because every key under it drops the prefix the heading already says.
 * `audit.retention.event_days` reads as `retention.event_days` under an `AUDIT` heading, and the
 * colour that had to be repeated as a dot on every row is now printed once.
 */
export function SystemSettingsPage() {
  // The permission `SystemSettingsController` asks for, rather than the role that happens to bundle it —
  // a personal deny takes this away from an administrator, and must.
  const mayOpen = useAuthStore((state) => state.holds)

  const { data: settings = [], isLoading } = useSystemSettings()
  const updateSetting = useUpdateSystemSetting()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  /**
   * Sorted by key, which is what puts a family's settings next to one another and therefore what
   * {@link keyUnderFamily} relies on — the grouping below is runs of an already-sorted list, not a
   * second sort. The filter matches the description too: somebody looking for the upload limit knows
   * the word "upload" long before they know it lives under `files.`.
   */
  const sorted = useMemo(() => [...settings].sort((left, right) => left.key.localeCompare(right.key)), [settings])

  /**
   * ⚠️ Assigned over **every** setting, never over the filtered ones. Colours handed out from what
   * survives a search would repaint the whole list on each keystroke, and `auth` would be a different
   * colour depending on what was typed — which is the one thing a group colour may never be.
   */
  const hues = useMemo(() => groupHues(sorted.map((setting) => familyOf(setting.key))), [sorted])

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return sorted.filter(
      (setting) =>
        needle === "" ||
        setting.key.toLowerCase().includes(needle) ||
        (setting.description ?? "").toLowerCase().includes(needle),
    )
  }, [sorted, search])

  /**
   * The visible settings, in runs of one family.
   *
   * ⚠️ **Built from `visible`, so a search narrows the groups with it** — a family whose every setting
   * was filtered out disappears rather than standing as an empty heading. Insertion order is the sort
   * order, which is alphabetical, so the groups come out alphabetical for free.
   */
  const families = useMemo(() => {
    const byFamily = new Map<string, SystemSetting[]>()

    for (const setting of visible) {
      const family  = familyOf(setting.key)
      const members = byFamily.get(family)

      if (members) {
        members.push(setting)
      } else {
        byFamily.set(family, [setting])
      }
    }

    return [...byFamily.entries()]
  }, [visible])

  if (!mayOpen(SYSTEM_SETTINGS)) {
    return (
      <AccessDenied
        title="System settings"
        why="System settings decide how the whole installation behaves — who may register, and how they sign in — so they are read over the installation rather than in a workspace."
        permissions={requiredPermissionsOf(SYSTEM_SETTINGS)}
      />
    )
  }

  function save(key: string, value: string) {
    updateSetting.mutate(
      { key, value },
      {
        onSuccess: () => setEditing(null),
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Failed to save.")
        },
      },
    )
  }

  return (
    <>
      <PageHeader title="System settings" description="Runtime configuration for the whole installation" />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        /* ⚠️ A ceiling on the width, because a setting is a label and a control rather than a document.
           Left to fill the page, a row on a 2560px screen puts its key at one edge and its switch at the
           other with two feet of nothing between them, and the description it is supposed to explain
           floats in the middle belonging to neither. */
        <div className="flex max-w-7xl flex-col gap-3">
          {/* The tally sits inside the field rather than beside it — it is about what the field is
              doing, and a line holding one control and one number reads as two things otherwise. */}
          <div className="relative w-full max-w-sm">
            <Input
              className="h-8 pr-24 text-sm"
              value={search}
              placeholder="Filter by key or description…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted-foreground">
              {visible.length === settings.length
                ? `${settings.length} settings`
                : `${visible.length} of ${settings.length}`}
            </span>
          </div>

          {families.map(([family, members]) => (
            <RowGroup
              key={family}
              label={
                <span className="flex items-center gap-1.5">
                  <GroupDot hue={hues.get(family)} label={family} />
                  {family}
                </span>
              }
              tally={members.length > 1 ? `${members.length} settings` : undefined}
            >
              <RowList>
                {members.map((setting) => (
                  <SettingRow
                    key={setting.key}
                    setting={setting}
                    saving={updateSetting.isPending}
                    editing={editing === setting.key}
                    draft={draft}
                    onDraft={setDraft}
                    onStartEdit={() => {
                      setEditing(setting.key)
                      setDraft(setting.value)
                    }}
                    onCancelEdit={() => setEditing(null)}
                    onSave={(value) => save(setting.key, value)}
                  />
                ))}
              </RowList>
            </RowGroup>
          ))}

          {visible.length === 0 && (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No setting matches “{search}”.
            </p>
          )}

          <BuildStrip />
        </div>
      )}
    </>
  )
}

/**
 * One setting: what it is called, what it does, and the control that changes it — on one line.
 *
 * ⚠️ **The description is a column, not a second line.** It is the half of the row that may shrink, so
 * it truncates and carries the full text as a `title`; the key and the control never give up room to
 * it. A sentence that wrapped under the key was what made this screen twice as tall as it needed to be.
 *
 * ⚠️ **When it was last changed is on the row, not in it.** It was a column for one screenshot and cost
 * about an eighth of the row's width — on a screen where the sub-navigation already takes a third of the
 * page, that eighth came straight out of the description, which truncated after four words. It is the
 * least-scanned thing here and the most-scanned thing is the sentence it was crowding out, so it moved
 * into the row's `title` beside the full key. Nothing is lost that a pointer does not recover.
 */
function SettingRow({
  setting,
  saving,
  editing,
  draft,
  onDraft,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  setting: SystemSetting
  saving: boolean
  editing: boolean
  draft: string
  onDraft: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (value: string) => void
}) {
  // The full key, because the row shows it without its family; and when it last moved, because the row
  // no longer shows it at all.
  const title = [setting.key, setting.updatedAt && `changed ${relativeTime(setting.updatedAt)}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <Row
      className={cn("items-center", editing && "bg-accent/60")}
      trailing={
        <>
          {/* ⚠️ A floor under the control column, so a switch, a dropdown and a slider do not each set
              their own right-hand edge. A ragged column of controls is what makes a settings list look
              unfinished, and it costs nothing to hold. */}
          <span className="flex min-w-[10rem] items-center justify-end gap-2">
            {setting.shape.kind === "FLAG" ? (
              <Switch
                checked={setting.value === "true"}
                disabled={saving}
                onCheckedChange={(next) => onSave(next ? "true" : "false")}
              />
            ) : setting.shape.kind === "CHOICE" ? (
              <PlainSelect
                value={setting.value}
                disabled={saving}
                className="h-7 w-auto min-w-40 text-xs"
                onChange={onSave}
              >
                {setting.shape.choices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </PlainSelect>
            ) : setting.shape.kind === "RANGE" ? (
              <SettingRange setting={setting} saving={saving} onCommit={(next) => onSave(String(next))} />
            ) : editing ? (
              <>
                <Input
                  autoFocus
                  className="h-7 w-56 font-mono text-xs"
                  value={draft}
                  onChange={(event) => onDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onSave(draft)
                    }

                    if (event.key === "Escape") {
                      onCancelEdit()
                    }
                  }}
                />
                <Button size="sm" className="h-7" disabled={saving} onClick={() => onSave(draft)}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              /* The value *is* the button. An Edit beside it spent a control and a strip of width
                 restating what clicking a value obviously does. */
              <button
                type="button"
                title="Edit"
                onClick={onStartEdit}
                className="max-w-64 truncate rounded border px-2 py-0.5 text-left font-mono text-xs hover:bg-accent"
              >
                {setting.value}
              </button>
            )}
          </span>
        </>
      }
    >
      <span className="flex min-w-0 items-baseline gap-2.5">
        {/* ⚠️ The family is printed on the group heading, so it is not repeated here — the key shown is
            what remains once the heading has said its part. The whole key, and when it last moved, are
            what the pointer gets back. */}
        <span title={title} className="shrink-0 font-mono text-xs">
          {keyUnderFamily(setting.key)}
        </span>

        {setting.description && (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={setting.description}>
            {setting.description}
          </span>
        )}
      </span>
    </Row>
  )
}

/**
 * A number between two bounds, dragged rather than typed.
 *
 * ⚠️ **The drag is local and the save is on release.** A slider that saved on every pixel would write a
 * row per frame, and — since some of these are refused by rules spanning two settings — would raise and
 * clear a refusal while somebody's finger was still down. The number beside it moves live so the drag is
 * still an answer to a question.
 *
 * The value comes back from the server after a save, so a refused change snaps back to what is actually
 * stored rather than leaving the handle where it was let go.
 */
function SettingRange({
  setting,
  saving,
  onCommit,
}: {
  setting: SystemSetting
  saving: boolean
  onCommit: (value: number) => void
}) {
  const minimum = setting.shape.minimum ?? 0
  const maximum = setting.shape.maximum ?? 100

  const [dragging, setDragging] = useState<number | null>(null)
  const shown = dragging ?? (Number(setting.value) || minimum)

  function commit() {
    if (dragging !== null) {
      onCommit(dragging)
      setDragging(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={setting.shape.step ?? 1}
        value={shown}
        disabled={saving}
        onChange={(event) => setDragging(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <Badge variant="secondary" className="h-5 w-11 justify-center px-0 font-mono text-[11px]">
        {shown}
      </Badge>
    </div>
  )
}

/**
 * What is actually running, as two lines under the settings rather than two cards above them.
 *
 * It sat first and largest, which put the one part of the page nobody can act on in front of the part
 * they came for. It is reference — read when a deployment is in question and ignored the rest of the
 * time — so it reads as a footer, in one line each.
 */
function BuildStrip() {
  const { data: backend } = useBackendBuildInfo()

  return (
    <div className="mt-1 flex flex-col gap-0.5 border-t pt-2 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16">Frontend</span>
        <code className="font-mono text-foreground">{__BUILD_ID__}</code>
        <span>
          v{__APPLICATION_VERSION__} · {__BUILD_DATE__} · <span className="font-mono">{__BUILD_HASH__}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16">Backend</span>
        {backend ? (
          <>
            <code className="font-mono text-foreground">{backend.buildId}</code>
            <span>
              {/* The name is what a person quotes; the number beside it is what they compare. Both,
                  because neither does the other's job. */}
              <strong className="text-foreground">{backend.codename}</strong> · v{backend.version}
              {backend.gitHash && (
                <>
                  {" · "}
                  <span className="font-mono">
                    {backend.gitHash}
                    {backend.dirty ? "*" : ""}
                  </span>
                </>
              )}
              {backend.gitBranch && <> · {backend.gitBranch}</>}
              {backend.buildTime && <> · built {new Date(backend.buildTime).toLocaleString()}</>}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Loading…</span>
        )}
      </div>
    </div>
  )
}

/**
 * What is left of a key once its group heading has said the family.
 *
 * `audit.retention.event_days` under an `AUDIT` heading is `retention.event_days` — the whole key is
 * still on the screen, spelled once instead of once per row. ⚠️ **Everything after the family is kept,
 * dots and all**, because the rest of the key is not a leaf: `retention.event_days` and a future
 * `export.event_days` are different settings that would otherwise print identically.
 *
 * A key with no dot at all is its own family and is shown whole, since a heading saying exactly what
 * the row says is better than a row saying nothing.
 */
function keyUnderFamily(key: string): string {
  const firstDot = key.indexOf(".")

  return firstDot < 0 ? key : key.slice(firstDot + 1)
}

/**
 * Which family a setting belongs to — the **first** segment, not the namespace {@link splitKey} draws.
 *
 * ⚠️ The two differ, on purpose. `audit.retention.event_days` is written `audit.retention.` +
 * `event_days`, because that is where a reader's eye splits the key; but it is one family with any
 * future `audit.something`, and a dot that said otherwise would break the only promise it makes.
 */
function familyOf(key: string): string {
  return key.split(".")[0]
}
