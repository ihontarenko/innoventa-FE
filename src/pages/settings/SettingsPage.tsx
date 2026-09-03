import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Camera, Pencil } from "lucide-react"
import { Badge, Button, Input, RowGroup, cn } from "@jmouse/ui"
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

  const roles = profile.roles ?? []

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h2 className="text-sm font-medium">Profile</h2>
        <p className="text-xs text-muted-foreground">
          Your face and your name — and, underneath them, what this account is across the whole installation.
        </p>
      </div>

      <div className="rounded-md border">
        {/*
          ⚠️ The face is a BUTTON, not a picture with a link under it. It is the only control on this
          card whose current value is also its affordance — you change your avatar by pressing your
          avatar — and a separate "Change picture" link would be a second thing to find for the same
          act. The whole picker is one dialog because picking a generated face and uploading a
          photograph are one decision: somebody opens it wanting to stop being two grey letters.

          ⚠️ **The corner badge is what says so, and it is always drawn.** It used to be a sentence
          beside the face — a grey instruction that had to be read, sat on no baseline anything else
          used, and said nothing once read. A badge is the same sentence in the one place it applies.
          It is not hover-revealed either: on a touch screen a hover state does not exist, so the
          affordance would be absent rather than merely small.
        */}
        <div className="flex items-center gap-4 p-4">
          <button
            type="button"
            onClick={() => setChoosingFace(true)}
            className="group relative shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-primary focus-visible:ring-ring focus-visible:outline-none"
            title="Change your face"
          >
            <AccountAvatar account={profile} className="size-14" />
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
            >
              <Camera className="size-3" />
            </span>
          </button>

          <IdentityBlock profile={profile} />
        </div>

        {/*
          ⚠️ **Two axes, two rows, and never one wrapped line of five identical pills.** The provider and
          the roles were rendered as a single flex row of badges: LOCAL and GLOBAL_ADMIN looked like
          members of one list, which reads as five things this account holds. One of them is how you got
          in and there is exactly one of it; the others are what you are and there can be any number. A
          labelled column is the cheapest thing that says which is which, and it lets a long role list
          hang off its own label instead of shoving the provider along the row.
        */}
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2.5 border-t px-4 py-3">
          {/* ⚠️ Signed in WITH rather than a bare provider name. "google" alone on a settings page reads
              as a setting somebody could change, and it is not one. */}
          <dt className="text-xs text-muted-foreground">Signed in with</dt>
          <dd>
            <Badge variant="secondary" className="font-mono text-[11px]">
              {profile.provider}
            </Badge>
          </dd>

          {roles.length > 0 && (
            <>
              <dt className="text-xs text-muted-foreground">Roles</dt>
              <dd className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} variant="outline" className="font-mono text-[11px]">
                    {role}
                  </Badge>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      <InstallationWidePermissions />

      <AvatarPickerDialog open={choosingFace} onOpenChange={setChoosingFace} />
    </div>
  )
}

/**
 * Who this account is, and the one fact about it that *is* yours to change.
 *
 * ⚠️ **Edited in place, not in a form below.** The name is the heading of the card. Repeating it in a
 * labelled box underneath would be the same string twice with a question about which one is real.
 *
 * ⚠️ **Name over email, not name beside it.** Side by side they were two strings on one row with a
 * Rename button flung to the far edge by `ml-auto`, and nothing tied the three together. Stacked, the
 * pair becomes one block the avatar stands against, and the button ends the row it belongs to.
 *
 * ⚠️ **Escape cancels and blank clears, and the two are different.** An empty box saved on purpose means
 * "call me by my email again", which is a real wish; an empty box abandoned means nothing.
 */
function IdentityBlock({ profile }: { profile: UserProfile }) {
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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{profile.displayName || profile.email}</div>
          {profile.displayName && <div className="truncate text-xs text-muted-foreground">{profile.email}</div>}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          disabled={change.isPending}
          onClick={() => {
            setDraft(profile.displayName ?? "")
            setEditing(true)
          }}
        >
          <Pencil className="size-3.5" />
          {change.isPending ? "Saving…" : "Rename"}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          maxLength={255}
          className="h-8 min-w-0 flex-1 text-sm"
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
        <Button size="sm" className="shrink-0" onClick={save}>
          Save
        </Button>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
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
 *
 * ⚠️ **The caption is RowGroup, not a hand-drawn copy of it.** The copy said the same words in a
 * brighter colour, at a tighter tracking, with the tally glued to the label instead of sitting at the
 * right — so the one section on this screen that is not a list of rows was also the one section that
 * captioned itself unlike every other screen in the product.
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
      <RowGroup label="Installation-wide" tally="nothing">
        <p className="text-xs text-muted-foreground">
          Everything you can do is inside a workspace. That is the ordinary case, and it is not the same as holding
          nothing at all.
        </p>
      </RowGroup>
    )
  }

  const openedGroup = groups.find((group) => group.prefix === opened) ?? null

  return (
    <RowGroup label="Installation-wide" tally={`${held.length} permissions in ${groups.length} areas`}>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((group) => (
          <ToggleChip
            key={group.prefix}
            active={opened === group.prefix}
            onClick={() => setOpened(opened === group.prefix ? null : group.prefix)}
          >
            {group.prefix}
            {/* ⚠️ A gap, because `access3` is a word with a digit stuck to it rather than an area and a
                count. Tabular figures keep the numbers a column even though the chips are not one. */}
            <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{group.permissions.length}</span>
          </ToggleChip>
        ))}
      </div>

      {/* ⚠️ **The panel says whose it is.** Thirty chips wrap to three rows, so the one that opened this
          can be a row and a half away — and an unlabelled box below them all is a list of names with no
          subject. It names its area, closes itself, and borrows the chip accent so the eye can pair the
          two across the gap. */}
      {openedGroup && (
        <div className="mt-1 flex flex-col gap-2 rounded-md border border-primary/40 bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {openedGroup.prefix}
            </span>
            <span className="text-[11px] text-muted-foreground">{openedGroup.permissions.length} permissions</span>
            <button
              type="button"
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setOpened(null)}
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {openedGroup.permissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex h-6 items-center rounded-md border bg-background px-2 font-mono text-[11px] text-muted-foreground"
              >
                {permission}
              </span>
            ))}
          </div>
        </div>
      )}
    </RowGroup>
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
