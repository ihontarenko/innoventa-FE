import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, Input, cn } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { AppearanceSettings } from "@/pages/AppearanceSettingsPage"
import {
  useChangeDisplayName,
  useConfirmTwoFactor,
  useDisableTwoFactor,
  useProfile,
  useSetupTwoFactor,
} from "@/hooks/useProfile"
import { useMyPermissions } from "@/hooks/useAccess"
import { authApi } from "@/api/auth"
import type { UserProfile } from "@/types"
import { AccountAvatar } from "@/components/AccountAvatar"
import { AvatarPickerDialog } from "@/components/account/AvatarPickerDialog"
import { AgentsTab } from "./AgentsTab"
import { MyActivityTab } from "./MyActivityTab"
import { NavigationTab } from "./NavigationTab"

const TABS = [
  { id: "profile", label: "Profile", glyph: "◉" },
  { id: "security", label: "Security", glyph: "⊘" },
  { id: "2fa", label: "2FA", glyph: "⊛" },
  { id: "agents", label: "Agents", glyph: "◈" },
  { id: "activity", label: "My activity", glyph: "◔" },
  { id: "appearance", label: "Appearance", glyph: "◐" },
  { id: "navigation", label: "Navigation", glyph: "☰" },
]

/**
 * The account: profile, security, agents, activity and appearance.
 *
 * ⚠️ **The open tab is in the address**, so a link can land on one — the agents tab sends people to
 * `/settings/activity?agent=…`, and a tab held in `useState` could not be arrived at.
 *
 * ⚠️ **The Navigation tab is subtractive and personal.** Nothing on it grants or refuses anything — a
 * hidden item is still reachable by address. What it changes is one sidebar.
 */
export function SettingsPage() {
  const { tab = "" } = useParams<{ tab?: string }>()
  const navigate = useNavigate()

  const { data: profile } = useProfile()

  const activeTab = TABS.some((entry) => entry.id === tab) ? tab : "profile"

  return (
    <>
      <PageHeader title="Account settings" description="Profile, security, agents and appearance" />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto lg:-mt-4 lg:-mb-4 lg:border-r lg:py-4 lg:pr-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => navigate(`/settings/${entry.id}`)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                activeTab === entry.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent/50",
              )}
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {entry.glyph}
              </span>
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {activeTab === "profile" && profile && <ProfileTab profile={profile} />}
          {activeTab === "security" && <PasswordTab />}
          {activeTab === "2fa" && profile && <TwoFactorTab profile={profile} />}
          {activeTab === "agents" && <AgentsTab />}
          {activeTab === "activity" && <MyActivityTab />}
          {activeTab === "appearance" && <AppearanceSettings />}
          {activeTab === "navigation" && <NavigationTab />}
        </div>
      </div>
    </>
  )
}

/**
 * Who you are here.
 *
 * ⚠️ **What this stopped being, and why.** It was a form: four boxes, three of them read-only, and one —
 * *Display name* — that looked editable, took keystrokes and **saved nothing**. A disabled box says "not
 * yours to change"; an enabled one that quietly discards what you typed says the product is broken. Facts
 * you cannot edit are shown as facts.
 */
function ProfileTab({ profile }: { profile: UserProfile }) {
  const [choosingFace, setChoosingFace] = useState(false)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h2 className="text-sm font-medium">Profile</h2>

      <div className="flex flex-col gap-3 rounded-md border p-4">
        {/*
          ⚠️ The face is a BUTTON, not a picture with a link under it. It is the only control on this
          card whose current value is also its affordance — you change your avatar by pressing your
          avatar — and a separate "Change picture" link would be a second thing to find for the same
          act. The whole picker is one dialog because picking a generated face and uploading a
          photograph are one decision: somebody opens it wanting to stop being two grey letters.
        */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setChoosingFace(true)}
            className="rounded-full ring-2 ring-transparent transition hover:ring-primary focus-visible:ring-ring focus-visible:outline-none"
            title="Change your face"
          >
            <AccountAvatar account={profile} className="size-14" />
          </button>

          <span className="text-xs text-muted-foreground">Press it to pick a different face.</span>
        </div>

        <DisplayNameLine profile={profile} />

        <div className="flex flex-wrap items-center gap-2">
          {/* ⚠️ Signed in WITH rather than a bare provider name. "google" alone on a settings page reads
              as a setting somebody could change, and it is not one. */}
          <span className="text-xs text-muted-foreground">signed in with</span>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {profile.provider}
          </Badge>

          {profile.roles?.map((role) => (
            <Badge key={role} variant="outline" className="font-mono text-[11px]">
              {role}
            </Badge>
          ))}
        </div>
      </div>

      <InstallationWidePermissions />

      <AvatarPickerDialog open={choosingFace} onOpenChange={setChoosingFace} />
    </div>
  )
}

/**
 * The one fact on this card that *is* yours to change.
 *
 * ⚠️ **Edited in place, not in a form below.** The name is the heading of the card. Repeating it in a
 * labelled box underneath would be the same string twice with a question about which one is real.
 *
 * ⚠️ **Escape cancels and blank clears, and the two are different.** An empty box saved on purpose means
 * "call me by my email again", which is a real wish; an empty box abandoned means nothing.
 */
function DisplayNameLine({ profile }: { profile: UserProfile }) {
  const change = useChangeDisplayName()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  function save() {
    setEditing(false)

    if (draft.trim() !== (profile.displayName ?? "")) {
      change.mutate(draft)
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-medium">{profile.displayName || profile.email}</span>
        {profile.displayName && <span className="text-xs text-muted-foreground">{profile.email}</span>}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={change.isPending}
          onClick={() => {
            setDraft(profile.displayName ?? "")
            setEditing(true)
          }}
        >
          {change.isPending ? "Saving…" : "✎ Rename"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        maxLength={255}
        className="h-8 w-64 text-sm"
        value={draft}
        placeholder={profile.email}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save()
          }

          if (event.key === "Escape") {
            setEditing(false)
          }
        }}
      />
      <Button size="sm" onClick={save}>
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <span className="text-[11px] text-muted-foreground">Leave it empty to go back to your email address.</span>
    </div>
  )
}

/**
 * What this account holds everywhere, rather than what it is called.
 *
 * ⚠️ **Ninety-two chips down a page is not a list, it is a wall.** The question this section answers is
 * *roughly how much, and over what*, so the areas are the answer and the individual permissions are the
 * follow-up.
 */
function InstallationWidePermissions() {
  const { data, isLoading } = useMyPermissions()

  const [opened, setOpened] = useState<string | null>(null)

  const held = useMemo(() => data?.permissions ?? [], [data])
  const groups = useMemo(() => groupPermissions(held), [held])

  if (isLoading) {
    return null
  }

  if (held.length === 0) {
    return (
      <section className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold tracking-[0.04em] uppercase">Installation-wide</span>
          <span className="text-xs text-muted-foreground">nothing</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Everything you can do is inside a workspace. That is the ordinary case, and it is not the same as holding
          nothing at all.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">Installation-wide</span>
        <span className="text-xs text-muted-foreground">
          {held.length} permissions in {groups.length} areas
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {groups.map((group) => (
          <ToggleChip
            key={group.prefix}
            active={opened === group.prefix}
            onClick={() => setOpened(opened === group.prefix ? null : group.prefix)}
          >
            {group.prefix} <span className="opacity-70">{group.permissions.length}</span>
          </ToggleChip>
        ))}
      </div>

      {opened && (
        <div className="flex flex-wrap gap-1 rounded-md border p-2">
          {(groups.find((group) => group.prefix === opened)?.permissions ?? []).map((permission) => (
            <span key={permission} className="rounded border px-1.5 py-0.5 font-mono text-[11px]">
              {permission}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * The area is the prefix before the first colon — the vocabulary this product already names permissions
 * in, so it needs no taxonomy of its own and cannot go stale.
 */
function groupPermissions(held: string[]): { prefix: string; permissions: string[] }[] {
  const byPrefix = new Map<string, string[]>()

  for (const permission of [...held].sort()) {
    const prefix = permission.includes(":") ? permission.slice(0, permission.indexOf(":")) : "general"

    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), permission])
  }

  return [...byPrefix.entries()]
    .map(([prefix, permissions]) => ({ prefix, permissions }))
    .sort((left, right) => left.prefix.localeCompare(right.prefix))
}

function PasswordTab() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (next !== confirmation) {
      toast.error("Passwords do not match.")
      return
    }

    if (next.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }

    setSaving(true)

    try {
      await authApi.changePassword(current, next)
      toast.success("Password changed.")
      setCurrent("")
      setNext("")
      setConfirmation("")
    } catch {
      toast.error("Current password is incorrect.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-medium">Change password</h2>

      <Labelled label="Current password">
        <Input type="password" className="h-8 text-sm" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </Labelled>
      <Labelled label="New password">
        <Input
          type="password"
          className="h-8 text-sm"
          minLength={8}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </Labelled>
      <Labelled label="Confirm password">
        <Input
          type="password"
          className="h-8 text-sm"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </Labelled>

      <div>
        <Button size="sm" disabled={saving || !current || next.length < 8} onClick={submit}>
          Change password
        </Button>
      </div>
    </div>
  )
}

function TwoFactorTab({ profile }: { profile: UserProfile }) {
  const setup = useSetupTwoFactor()
  const confirm = useConfirmTwoFactor()
  const disable = useDisableTwoFactor()

  const [qr, setQr] = useState<{ qrCodeBase64: string; plainTextSecret: string } | null>(null)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [disabling, setDisabling] = useState(false)

  return (
    <div className="flex max-w-md flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">Two-factor authentication</h2>
        <p className="text-xs text-muted-foreground">Protect your account with a TOTP authenticator app.</p>
      </div>

      {!profile.twoFactorEnabled && !qr && (
        <div>
          <Button
            size="sm"
            disabled={setup.isPending}
            onClick={() => setup.mutate(undefined, { onSuccess: setQr, onError: () => toast.error("Could not start setup.") })}
          >
            {setup.isPending ? "Generating…" : "Set up 2FA"}
          </Button>
        </div>
      )}

      {qr && (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <img src={qr.qrCodeBase64} alt="TOTP QR code" className="size-44 self-center" />
          <p className="text-xs text-muted-foreground">
            Scan with your authenticator app, then enter the code below.
          </p>
          <code className="rounded bg-muted px-2 py-1 text-center font-mono text-xs">{qr.plainTextSecret}</code>

          <Labelled label="Verification code">
            <Input
              autoFocus
              maxLength={6}
              className="h-8 font-mono text-sm"
              value={code}
              placeholder="000000"
              onChange={(event) => setCode(event.target.value)}
            />
          </Labelled>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setQr(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={code.length !== 6 || confirm.isPending}
              onClick={() =>
                confirm.mutate(
                  { plainTextSecret: qr.plainTextSecret, verificationCode: code },
                  {
                    onSuccess: () => {
                      setQr(null)
                      setCode("")
                      toast.success("2FA enabled.")
                    },
                    onError: () => toast.error("Invalid code."),
                  },
                )
              }
            >
              Enable 2FA
            </Button>
          </div>
        </div>
      )}

      {profile.twoFactorEnabled && !disabling && (
        <>
          <Callout tone="success">
            <span>2FA is enabled on your account.</span>
          </Callout>
          <div>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDisabling(true)}>
              Disable 2FA…
            </Button>
          </div>
        </>
      )}

      {profile.twoFactorEnabled && disabling && (
        <div className="flex flex-col gap-3">
          <Labelled label="Confirm with password">
            <Input
              autoFocus
              type="password"
              className="h-8 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Labelled>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDisabling(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!password || disable.isPending}
              onClick={() =>
                disable.mutate(password, {
                  onSuccess: () => {
                    setDisabling(false)
                    setPassword("")
                    toast.success("2FA disabled.")
                  },
                  onError: () => toast.error("Incorrect password."),
                })
              }
            >
              Disable 2FA
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  )
}
