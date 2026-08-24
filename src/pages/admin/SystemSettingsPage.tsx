import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge, Button, cn, Input, RowList, Skeleton, Switch } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { GroupDot } from "@/components/GroupDot"
import { PageHeader } from "@/components/PageHeader"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useBackendBuildInfo, useSystemSettings, useUpdateSystemSetting } from "@/hooks/useSystemSettings"
import { useAuthStore } from "@/stores/authStore"
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
 */
export function SystemSettingsPage() {
  // The permission `SystemSettingsController` asks for, rather than the role that happens to bundle it —
  // a personal deny takes this away from an administrator, and must.
  const holdsEverywhere = useAuthStore((state) => state.holdsEverywhere)

  const { data: settings = [], isLoading } = useSystemSettings()
  const updateSetting = useUpdateSystemSetting()

  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  /**
   * Sorted by key, which is what puts a namespace's settings next to one another — see {@link splitKey}.
   * The filter matches the description too: somebody looking for the upload limit knows the word
   * "upload" long before they know it lives under `files.`.
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

  if (!holdsEverywhere("settings:read")) {
    return (
      <AccessDenied
        title="System settings"
        why="System settings decide how the whole installation behaves — who may register, and how they sign in — so they are read over the installation rather than in a workspace."
        permissions={["settings:read"]}
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
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Input
              className="h-8 w-72 text-sm"
              value={search}
              placeholder="Filter by key or description…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {visible.length === settings.length ? `${settings.length} settings` : `${visible.length} of ${settings.length}`}
            </span>
          </div>

          {/* ⚠️ Carded rather than divided, and it is the second line that decides. Every row here has a
              description under it, and a description on a shared ground reads as a row of its own — so
              each setting gets a border of its own and the pair stays one thing. */}
          <RowList variant="carded">
            {visible.map((setting) => (
              <SettingRow
                key={setting.key}
                setting={setting}
                hue={hues.get(familyOf(setting.key))}
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

            {visible.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                No setting matches “{search}”.
              </p>
            )}
          </RowList>

          <BuildStrip />
        </div>
      )}
    </>
  )
}

function SettingRow({
  setting,
  hue,
  saving,
  editing,
  draft,
  onDraft,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  setting: SystemSetting
  hue: number | undefined
  saving: boolean
  editing: boolean
  draft: string
  onDraft: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (value: string) => void
}) {
  const { namespace, leaf } = splitKey(setting.key)
  const family = familyOf(setting.key)

  return (
    <div className={cn("flex flex-col gap-1 rounded-md border px-3 py-2", editing && "bg-accent/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-64 items-center gap-2 font-mono text-xs">
          <GroupDot hue={hue} label={family} />
          <span className="text-muted-foreground">{namespace}</span>
          {leaf}
        </span>

        <div className="flex flex-1 items-center justify-end gap-2">
          {setting.shape.kind === "FLAG" ? (
            <Switch
              checked={setting.value === "true"}
              disabled={saving}
              onCheckedChange={(next) => onSave(next ? "true" : "false")}
            />
          ) : setting.shape.kind === "CHOICE" ? (
            <PlainSelect value={setting.value} disabled={saving} className="w-auto min-w-48" onChange={onSave}>
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
                className="h-8 w-72 font-mono text-sm"
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
              <Button size="sm" disabled={saving} onClick={() => onSave(draft)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
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
              className="max-w-96 truncate rounded border px-2 py-1 text-left font-mono text-xs hover:bg-accent"
            >
              {setting.value}
            </button>
          )}
        </div>
      </div>

      {/* One second line, never two. The description and the last change are both about this setting
          and neither is long enough to earn a row of its own. */}
      {(setting.description || setting.updatedAt) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {setting.description && <span>{setting.description}</span>}
          {setting.updatedAt && <span className="ml-auto font-mono">changed {relativeTime(setting.updatedAt)}</span>}
        </div>
      )}
    </div>
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
        className="h-1.5 w-48 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <Badge variant="secondary" className="w-14 justify-center font-mono">
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
    <div className="flex flex-col gap-1 rounded-md border p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-muted-foreground">Frontend</span>
        <code className="font-mono">{__BUILD_ID__}</code>
        <span className="text-muted-foreground">
          v{__APPLICATION_VERSION__} · {__BUILD_DATE__} · <span className="font-mono">{__BUILD_HASH__}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-muted-foreground">Backend</span>
        {backend ? (
          <>
            <code className="font-mono">{backend.buildId}</code>
            <span className="text-muted-foreground">
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
 * The key split where the reader's eye already splits it.
 *
 * Keys are `namespace.leaf` and sorting them alphabetically groups them for free, so the grouping needs
 * no headers, no hardcoded sections and no vertical space at all — only the namespace drawn quieter than
 * the leaf. Section headings over ten namespaces, six of which hold one setting each, would cost more
 * room than the grouping saves.
 */
function splitKey(key: string): { namespace: string; leaf: string } {
  const lastDot = key.lastIndexOf(".")

  if (lastDot < 0) {
    return { namespace: "", leaf: key }
  }

  return { namespace: key.slice(0, lastDot + 1), leaf: key.slice(lastDot + 1) }
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
