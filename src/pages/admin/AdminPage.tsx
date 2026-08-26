import { AccountAvatar } from "@/components/AccountAvatar"
import { useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { Callout } from "@/components/Callout"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { ToggleChip } from "@/components/ToggleChip"
import {
  useAdminCreateRole,
  useAdminCreateUser,
  useAdminDeleteRole,
  useAdminDeleteUser,
  useAdminDrawAvatar,
  useAdminPermissions,
  useAdminRemoveUserPermission,
  useAdminResetPassword,
  useAdminRoles,
  useAdminRolesDetailed,
  useAdminSetUserPermission,
  useAdminUpdateRole,
  useAdminUpdateUser,
  useAdminUploadAvatar,
  useAdminUserPermissions,
  useAdminUsers,
  useBeginImpersonation,
} from "@/hooks/useAdministration"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"
import { readableDate } from "@/lib/dates"
import { isClientAccount, type AccountKind, type AdminUser, type PermissionEffect, type RoleView } from "@/api/admin"

type Tab = "users" | "roles" | "permissions"

/** The roles the application ships with — they cannot be deleted, however a screen feels about it. */
const BUILT_IN_ROLES = new Set(["GLOBAL_ADMIN", "GLOBAL_MANAGER", "GLOBAL_MEMBER", "GLOBAL_BOOTSTRAP", "GLOBAL_GOD"])

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const USERS = platformItem("admin-users")

/**
 * Accounts, roles and the permission catalogue.
 *
 * ⚠️ **There is no Agents tab.** It listed accounts this table already holds, so an agent had to be
 * administered on a different screen from everybody else — one table, two lists, two vocabularies.
 * Clients are a segment of Users.
 */
export function AdminPage() {
  /*
   * ⚠️ The permission, never the role. A role is a bundle of permissions and nothing else, so gating on
   * one asks a question the authorization model does not answer: a personal `deny` takes `user:read`
   * away from an administrator and leaves the role behind, and a personal `allow` grants it to somebody
   * who will never hold GLOBAL_ADMIN.
   *
   * Installation-wide, because there is no workspace in this question: administering accounts is about
   * the installation, and the coarse "holds it somewhere" answer would open it to anybody granted the
   * permission in one workspace.
   */
  const mayOpen = useAuthStore((state) => state.holds)

  const [activeTab, setActiveTab] = useState<Tab>("users")
  const [creatingUser, setCreatingUser] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)

  if (!mayOpen(USERS)) {
    return (
      <AccessDenied
        title="User management"
        why="User management reads and administers accounts across the whole installation, and this account has not been given that."
        permissions={requiredPermissionsOf(USERS)}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="User management"
        description="Accounts, roles and the permission catalogue"
        actions={
          <>
            {activeTab === "users" && <Button size="sm" onClick={() => setCreatingUser(true)}>New user</Button>}
            {activeTab === "roles" && <Button size="sm" onClick={() => setCreatingRole(true)}>New role</Button>}
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as Tab)} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {activeTab === "users" && <UsersPanel />}
        {activeTab === "roles" && <RolesPanel />}
        {activeTab === "permissions" && <PermissionsPanel />}
      </Tabs>

      {creatingUser && <CreateUserDialog onClose={() => setCreatingUser(false)} />}
      {creatingRole && <CreateRoleDialog onClose={() => setCreatingRole(false)} />}
    </>
  )
}

/**
 * Which rows the account list is showing.
 *
 * ⚠️ **`Clients`, not `Slaves`.** A `RESTRICTED` agent's permissions are not a subset of its owner's, and
 * a person owning no agent is not above anybody. `client` is also already what this product prints on an
 * audit by-line.
 */
const ACCOUNT_SEGMENTS: { segment: string; label: string; kind?: AccountKind }[] = [
  { segment: "all", label: "All" },
  { segment: "people", label: "People", kind: "PERSON" },
  { segment: "clients", label: "Clients", kind: "AGENT" },
]

const PAGE_SIZE = 25

/**
 * Every account in the installation.
 *
 * ⚠️ **One action per row, and the rest of them inside it.** This column used to hold six controls —
 * disable, enter as, edit, permissions, reset password, delete — so the table was wider than the screen
 * and the row's most destructive control sat a few pixels from its most ordinary one. They are six things
 * one does *to an account*, which is a screen of its own.
 */
function UsersPanel() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [segment, setSegment] = useState("all")
  const [openedId, setOpenedId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search, 250)
  const kind = ACCOUNT_SEGMENTS.find((entry) => entry.segment === segment)?.kind
  const { data: usersPage, isLoading } = useAdminUsers(debouncedSearch || undefined, page, PAGE_SIZE, kind)

  const users = usersPage?.content ?? []
  const showingClients = segment !== "people"

  // Re-derived from the page rather than held as a snapshot, so an edit made inside the dialog is what
  // the dialog goes on showing — a captured object would keep rendering the values that were true when
  // it opened.
  const opened = users.find((account) => account.id === openedId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="h-8 w-64 text-sm"
          value={search}
          placeholder="Email or name…"
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(0)
          }}
        />

        {/* One table, three views of it — never a second query with a second idea of what a row is. The
            page resets with the segment, because page 3 of the people is not page 3 of anything else. */}
        <div className="flex gap-1" role="group" aria-label="Which accounts to show">
          {ACCOUNT_SEGMENTS.map((entry) => (
            <ToggleChip
              key={entry.segment}
              active={segment === entry.segment}
              onClick={() => {
                setSegment(entry.segment)
                setPage(0)
              }}
            >
              {entry.label}
            </ToggleChip>
          ))}
        </div>

        {/* ⚠️ The count follows the segment because it is the segment's count — the server answers with
            the total for the filter it was given. A header saying "1 account" over three visible rows is
            the small kind of lie worth more than it costs. */}
        <span className="text-xs text-muted-foreground">
          {usersPage?.totalElements ?? 0} {(usersPage?.totalElements ?? 0) === 1 ? "account" : "accounts"}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
          <span aria-hidden="true" className="text-2xl">
            ⌘
          </span>
          <span className="text-sm font-medium">Nothing matches</span>
          <span className="text-xs text-muted-foreground">No account in this installation answers to that.</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  {/* Only where it can be filled: a person has no owner, and a column of dashes teaches
                      nothing. */}
                  {showingClients && <TableHead className="w-40">Owner</TableHead>}
                  <TableHead className="w-28">Provider</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32">Last login</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {isClientAccount(account) ? (account.displayName ?? account.email) : account.email}
                        </span>
                        {isClientAccount(account) ? (
                          /* ⚠️ A client is named, not addressed. Its email is a synthetic string nobody
                             writes to, so showing it where a person's address goes would invite somebody
                             to try. */
                          <span className="text-[11px] text-muted-foreground">
                            {account.retiredAt ? "client, retired" : "client"}
                          </span>
                        ) : (
                          account.displayName && (
                            <span className="text-[11px] text-muted-foreground">{account.displayName}</span>
                          )
                        )}
                      </div>
                    </TableCell>

                    {showingClients && (
                      <TableCell className="text-xs text-muted-foreground">
                        {isClientAccount(account) ? (account.ownerName ?? "unknown") : "—"}
                      </TableCell>
                    )}

                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        {account.provider}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {account.roles.map((role) => (
                          <RoleBadge key={role} role={role} />
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={account.enabled ? "default" : "destructive"}>
                        {account.enabled ? "Active" : "Disabled"}
                      </Badge>
                      {account.failedLoginCount > 0 && (
                        <div className="text-[11px] text-muted-foreground">{account.failedLoginCount} failed</div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">{formatDate(account.lastLoginAt)}</TableCell>

                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOpenedId(account.id)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={page}
            totalPages={usersPage?.totalPages ?? 0}
            totalElements={usersPage?.totalElements ?? 0}
            size={usersPage?.size ?? PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}

      {opened && <UserDetailDialog user={opened} onClose={() => setOpenedId(null)} />}
    </div>
  )
}

function formatDate(value: string | null): string {
  return value ? readableDate(value) : "Never"
}

function RolesPanel() {
  const [editing, setEditing] = useState<RoleView | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: roles = [], isLoading } = useAdminRolesDetailed()
  const deleteRole = useAdminDeleteRole()

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="flex flex-col gap-3">
      {roles.map((role) => (
        <div key={role.roleName} className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={role.roleName} />
            {BUILT_IN_ROLES.has(role.roleName) && <Badge variant="outline">built-in</Badge>}

            {/* ⚠️ A file owns this bundle, so the controls go rather than refuse. The server says no
                either way; offering an Edit button that always fails is the screen lying about what it
                can do. */}
            {role.declaredInPolicy && (
              <Badge variant="secondary" title="Declared in a policy document — edit it under Access control">
                in policy
              </Badge>
            )}

            <div className="ml-auto flex gap-2">
              {!role.declaredInPolicy && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(role)}>
                  Edit permissions
                </Button>
              )}

              {!BUILT_IN_ROLES.has(role.roleName) &&
                !role.declaredInPolicy &&
                (deleting === role.roleName ? (
                  <Button variant="destructive" size="sm" onClick={() => deleteRole.mutate(role.roleName)}>
                    Really delete {role.roleName}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleting(role.roleName)}
                  >
                    Delete role
                  </Button>
                ))}
            </div>
          </div>

          {role.permissions.length === 0 ? (
            <span className="text-xs text-muted-foreground">No permissions assigned</span>
          ) : (
            <PermissionGroups permissions={role.permissions} />
          )}

          {role.declaredInPolicy && (
            <p className="text-xs text-muted-foreground">
              What this role carries is declared in a policy document and is edited under{" "}
              <span className="font-mono">/admin/access</span>.
            </p>
          )}
        </div>
      ))}

      {editing && <EditRoleDialog role={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/**
 * Every permission this build declares — a catalogue to read, never a list to edit.
 *
 * ⚠️ The add and delete controls that used to be here are gone, and their absence is the point. A
 * permission is a compile-time constant in the backend, because the code that asks about one holds it as
 * a symbol. One minted from this screen was a name nothing ever checked: it appeared in every list, could
 * be granted to anybody, and did nothing — which reads as a power somebody has and behaves as no power at
 * all.
 */
function PermissionsPanel() {
  const { data: permissions = [], isLoading } = useAdminPermissions()

  return (
    <div className="flex flex-col gap-3">
      <Callout tone="info">
        <span>
          <strong>
            {permissions.length} permission{permissions.length === 1 ? "" : "s"} in this build.
          </strong>{" "}
          Permissions are declared in the application itself, in the form <span className="font-mono">resource:action</span>.
          They cannot be added or removed from here — what a role carries is edited under <strong>Roles</strong>, and where
          each one reaches is <span className="font-mono">/admin/access</span>.
        </span>
      </Callout>

      {isLoading ? <Skeleton className="h-64 w-full" /> : <PermissionGroups permissions={permissions} />}
    </div>
  )
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [roles, setRoles] = useState<string[]>(["GLOBAL_MEMBER"])

  const { data: availableRoles = [] } = useAdminRoles()
  const createUser = useAdminCreateUser()

  function submit() {
    createUser.mutate(
      { email, password, displayName: displayName || undefined, roles },
      {
        onSuccess: onClose,
        onError: (error) => toast.error(detailOf(error) ?? "Failed to create user."),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>The account can sign in immediately with the password you set here.</DialogDescription>
        </DialogHeader>

        <Field label="Email" required>
          <Input autoFocus type="email" className="h-8 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <Field label="Password" required>
          <Input
            type="password"
            className="h-8 text-sm"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="Display name">
          <Input className="h-8 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>

        <RoleSelector availableRoles={availableRoles} selected={roles} onChange={setRoles} />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={createUser.isPending || !email || password.length < 6} onClick={submit}>
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── One account, opened ──────────────────────────────────────────────────────

type UserTab = "account" | "permissions" | "security"

/**
 * Everything one does *to* an account, on the screen that is about that account.
 *
 * It replaces three dialogs reached from three buttons in a table row. They were three because they were
 * written one at a time, not because they answer three questions: an administrator opening one of them is
 * looking at a person, and the next thing they want is nearly always in one of the other two.
 *
 * The facts sit above the tabs rather than inside one, because they are true whichever tab is open — and
 * a reader who has to go back to the Account tab to check which provider somebody signed up with has been
 * made to navigate for something that was never a choice.
 */
function UserDetailDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [tab, setTab] = useState<UserTab>("account")

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.displayName || user.email}
            <Badge variant={user.enabled ? "default" : "destructive"}>{user.enabled ? "Active" : "Disabled"}</Badge>
          </DialogTitle>
          <DialogDescription>Who this is, what they hold, and everything that is felt immediately.</DialogDescription>
        </DialogHeader>

        {/* ⚠️ A client's facts are not a person's, and showing a person's shape for one would be six wrong
            answers: it has no address anybody writes to, no provider that means anything, no second
            factor and no logins to fail. */}
        {isClientAccount(user) ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Owner" value={user.ownerName ?? "unknown"} />
            <Fact label="Standing" value={user.retiredAt ? "Retired" : "Live"} />
            <Fact label="Created" value={formatDate(user.createdAt)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Email" value={user.email} />
            <Fact label="Provider" value={user.provider} />
            <Fact label="Two-factor" value={user.twoFactorEnabled ? "On" : "Off"} />
            <Fact label="Last login" value={formatDate(user.lastLoginAt)} />
            <Fact label="Created" value={formatDate(user.createdAt)} />
            <Fact label="Failed logins" value={String(user.failedLoginCount)} />
          </div>
        )}

        <Tabs value={tab} onValueChange={(next) => setTab(next as UserTab)}>
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === "account" && (isClientAccount(user) ? <ClientAccountTab user={user} /> : <AccountTab user={user} />)}
          {tab === "permissions" && <UserPermissionsTab user={user} />}
          {tab === "security" && <SecurityTab user={user} onClose={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What a **client** is — its name and its face, and nothing about what it may do.
 *
 * ⚠️ **Why this is not {@link AccountTab} with three fields hidden.** A person's account tab edits a
 * display name, whether they may sign in, and which roles they hold. Two of those three are meaningless
 * here and the third is dangerous: a client cannot sign in at all — a database CHECK refuses it — and its
 * roles are not administered on this screen in any product.
 *
 * ⚠️ **The name is written through the same route a person's is**, and the backend is what knows the
 * difference: it renames the agent directory so the account row *follows*. A screen that wrote the row
 * directly would leave an audit by-line saying what the client used to be called.
 */
function ClientAccountTab({ user }: { user: AdminUser }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "")

  const updateUser = useAdminUpdateUser()
  const changed = displayName !== (user.displayName ?? "")

  return (
    <div className="flex flex-col gap-3">
      <ClientFace user={user} />

      <Field label="Name">
        <Input className="h-8 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </Field>

      <p className="text-xs text-muted-foreground">
        Renaming writes through the agent directory, so every by-line this client has ever left starts reading the new
        name — that is what a name is for here.
      </p>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!changed || updateUser.isPending}
          onClick={() =>
            updateUser.mutate(
              { userId: user.id, displayName: displayName || undefined },
              {
                onSuccess: () => toast.success("Renamed."),
                onError: (error) => toast.error(detailOf(error) ?? "Failed to rename the client."),
              },
            )
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}

/**
 * A client's face — the drawn one it was born with, or a picture somebody uploaded for it.
 *
 * ⚠️ **The drawn face is the ordinary case, not a fallback.** A client is provisioned wearing a weave
 * generated from its own identifier, so two clients of one person are told apart at a glance and neither
 * wears the face of the person who was asleep at the time.
 */
function ClientFace({ user }: { user: AdminUser }) {
  const uploadAvatar = useAdminUploadAvatar()
  const drawAvatar = useAdminDrawAvatar()
  const busy = uploadAvatar.isPending || drawAvatar.isPending

  function report(error: unknown) {
    toast.error(detailOf(error) ?? "Could not change the picture.")
  }

  return (
    <div className="flex items-center gap-3">
      {/* Three kinds, one component. A client's drawn face is the ordinary case here rather than a
          fallback — it is provisioned with one, seeded from its own identifier, so two clients of one
          person are told apart at a glance. */}
      <AccountAvatar account={user} className="size-14 shrink-0 border" />

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border px-2 py-1 text-xs hover:bg-accent">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const picture = event.target.files?.[0]

              if (picture) {
                uploadAvatar.mutate({ userId: user.id, file: picture }, { onError: report })
              }
            }}
          />
          Upload a picture
        </label>

        <Button variant="ghost" size="sm" disabled={busy} onClick={() => drawAvatar.mutate(user.id, { onError: report })}>
          Use the drawn one
        </Button>
      </div>
    </div>
  )
}

/** What the account *is* — its name, whether it may sign in, and which roles it holds. */
function AccountTab({ user }: { user: AdminUser }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "")
  const [enabled, setEnabled] = useState(user.enabled)
  const [roles, setRoles] = useState<string[]>(user.roles)

  const { data: availableRoles = [] } = useAdminRoles()
  const updateUser = useAdminUpdateUser()

  const changed =
    displayName !== (user.displayName ?? "") || enabled !== user.enabled || roles.join() !== user.roles.join()

  return (
    <div className="flex flex-col gap-3">
      <Field label="Display name">
        <Input className="h-8 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </Field>

      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <span className="text-xs">{enabled ? "May sign in" : "Cannot sign in — every session is refused"}</span>
      </div>

      <RoleSelector availableRoles={availableRoles} selected={roles} onChange={setRoles} />

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!changed || updateUser.isPending}
          onClick={() =>
            updateUser.mutate(
              { userId: user.id, displayName: displayName || undefined, enabled, roles },
              {
                onSuccess: () => toast.success("Saved."),
                onError: (error) => toast.error(detailOf(error) ?? "Failed to update user."),
              },
            )
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}

/**
 * The three things that are done *about* an account rather than to its contents.
 *
 * They are together because they share one property: each of them is felt by the person whose account it
 * is, immediately. Setting a password ends their ability to sign in with the one they know; entering
 * their account is somebody else acting as them; deleting it is final.
 */
function SecurityTab({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingEntry, setConfirmingEntry] = useState(false)

  const resetPassword = useAdminResetPassword()
  const deleteUser = useAdminDeleteUser()

  /**
   * The control sits here because this is where somebody is when they need it. What the route checks is a
   * separate question: it is gated on `user:impersonate` alone, not on the admin role and not on being
   * inside this screen.
   */
  const currentUser = useAuthStore((state) => state.user)
  const mayImpersonate = useAuthStore((state) => state.holdsSomewhere)("user:impersonate")
  const beginImpersonation = useBeginImpersonation()

  function reset() {
    if (password !== confirmation) {
      toast.error("Passwords do not match.")
      return
    }

    resetPassword.mutate(
      { userId: user.id, newPassword: password },
      {
        onSuccess: () => {
          setPassword("")
          setConfirmation("")
          toast.success("Password set.")
        },
        onError: (error) => toast.error(detailOf(error) ?? "Failed to reset password."),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Set a password</h3>
        <p className="text-xs text-muted-foreground">
          The account can sign in with this immediately, and the password they knew stops working. Nobody is told — say
          so yourself.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="New password">
            <Input
              type="password"
              className="h-8 text-sm"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm password">
            <Input
              type="password"
              className="h-8 text-sm"
              minLength={6}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button size="sm" disabled={resetPassword.isPending || password.length < 6} onClick={reset}>
            Set password
          </Button>
        </div>
      </section>

      {mayImpersonate && user.id !== currentUser?.id && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Work as this account</h3>
          <p className="text-xs text-muted-foreground">
            Thirty minutes, recorded under both names, and unable to change their password, email or two-factor
            settings. It is how a reported problem is reproduced without being told what somebody's screen looked like.
          </p>

          {confirmingEntry ? (
            <Callout tone="warning">
              <span>
                Everything you do will be recorded under <strong>both</strong> your name and theirs. The session lasts 30
                minutes and cannot change their password, email or two-factor settings.
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={beginImpersonation.isPending}
                  onClick={() => beginImpersonation.mutate(user.id)}
                >
                  Enter as {user.email}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmingEntry(false)}>
                  Stay as myself
                </Button>
              </div>
            </Callout>
          ) : (
            <div>
              <Button variant="outline" size="sm" onClick={() => setConfirmingEntry(true)}>
                Enter as {user.email}
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Delete this account</h3>
        <p className="text-xs text-muted-foreground">
          ⚠️ Their grants are not removed by the database — nothing cascades from an account to the authorization
          tables — so deleting one is a decision to take, not a tidy-up. It cannot be undone.
        </p>

        <div>
          {confirmingDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                deleteUser.mutate(user.id)
                onClose()
              }}
            >
              Really delete {user.email} — this cannot be undone
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete {user.email}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

type GrantState = "INHERIT" | "ALLOW" | "DENY"

function UserPermissionsTab({ user }: { user: AdminUser }) {
  const [search, setSearch] = useState("")

  const { data: allPermissions = [] } = useAdminPermissions()
  const { data: userPermissions, isLoading } = useAdminUserPermissions(user.id)
  const setUserPermission = useAdminSetUserPermission()
  const removeUserPermission = useAdminRemoveUserPermission()

  const rolePermissions = new Set(userPermissions?.rolePermissions ?? [])
  const effective = new Set(userPermissions?.effective ?? [])

  // ⚠️ Keyed by permission NAME. There is no permission identifier any more — a permission is a constant
  // in the application rather than a row, so its name is the only thing there is to key on.
  const grantByPermission = new Map((userPermissions?.grants ?? []).map((grant) => [grant.permissionName, grant.effect]))

  function apply(permission: string, next: GrantState) {
    if (next === "INHERIT") {
      removeUserPermission.mutate({ userId: user.id, permission })
      return
    }

    setUserPermission.mutate({ userId: user.id, permission, effect: next as PermissionEffect })
  }

  const visible = allPermissions.filter((permission) => permission.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Direct grants override the account's role permissions: <span className="font-mono">(role ∪ allow) − deny</span>.{" "}
        <strong>Deny</strong> always wins. Where each one <em>reaches</em> is a different question, answered under{" "}
        <span className="font-mono">/admin/access</span>.
      </p>

      {/* ⚠️ What these buttons write, in the notation the policy editor uses. The two screens edit the
          same rows and neither says so — somebody who only ever presses buttons here has no way to
          discover that the other exists. Naming the row's own line is the cheapest bridge there is. */}
      <p className="text-xs text-muted-foreground">
        Each press writes a <strong>row</strong>, spelled <span className="font-mono">deny entry:write</span> in policy
        notation. The policy document under <span className="font-mono">/admin/access</span> is a projection of those
        same rows, so a line written there and a press here land in one place.
      </p>

      <Input
        className="h-8 w-64 text-sm"
        value={search}
        placeholder="Filter permissions…"
        onChange={(event) => setSearch(event.target.value)}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col divide-y rounded-md border">
          {visible.map((permission) => {
            const state = (grantByPermission.get(permission) as GrantState) ?? "INHERIT"
            const fromRole = rolePermissions.has(permission)
            const isEffective = effective.has(permission)

            return (
              <div key={permission} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                <span className="min-w-56 font-mono text-xs">{permission}</span>
                {fromRole && <Badge variant="outline">role</Badge>}

                <span
                  className={cn("ml-auto text-xs", isEffective ? "text-success" : "text-muted-foreground")}
                  title={isEffective ? "Effective: granted" : "Effective: not granted"}
                >
                  {isEffective ? "✓" : "✕"}
                </span>

                <div className="flex gap-0.5 rounded-md border p-0.5">
                  {(["INHERIT", "ALLOW", "DENY"] as GrantState[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        state === option && option === "ALLOW" && "bg-success text-background",
                        state === option && option === "DENY" && "bg-destructive text-destructive-foreground",
                        state === option && option === "INHERIT" && "bg-muted",
                        state !== option && "text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => apply(permission, option)}
                    >
                      {option === "INHERIT" ? "Inherit" : option === "ALLOW" ? "Allow" : "Deny"}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {visible.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No permissions match “{search}”.</p>
          )}
        </div>
      )}
    </div>
  )
}

function CreateRoleDialog({ onClose }: { onClose: () => void }) {
  const [roleName, setRoleName] = useState("")
  const [selected, setSelected] = useState<string[]>([])

  const { data: permissions = [] } = useAdminPermissions()
  const createRole = useAdminCreateRole()

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create role</DialogTitle>
          <DialogDescription>A role is a bundle of permissions and nothing else.</DialogDescription>
        </DialogHeader>

        <Field label="Role name" required>
          <Input
            autoFocus
            className="h-8 font-mono text-sm"
            value={roleName}
            placeholder="e.g. AUDITOR"
            onChange={(event) => setRoleName(event.target.value.toUpperCase())}
          />
        </Field>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <PermissionSelector permissions={permissions} selected={selected} onChange={setSelected} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={createRole.isPending || roleName.trim().length === 0}
            onClick={() =>
              createRole.mutate(
                { roleName, permissions: selected },
                { onSuccess: onClose, onError: (error) => toast.error(detailOf(error) ?? "Failed to create role.") },
              )
            }
          >
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditRoleDialog({ role, onClose }: { role: RoleView; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(role.permissions)

  const { data: permissions = [] } = useAdminPermissions()
  const updateRole = useAdminUpdateRole()

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit permissions · {role.roleName}</DialogTitle>
          <DialogDescription>What everybody holding this role carries, everywhere.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <PermissionSelector permissions={permissions} selected={selected} onChange={setSelected} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={updateRole.isPending}
            onClick={() =>
              updateRole.mutate(
                { roleName: role.roleName, permissions: selected },
                { onSuccess: onClose, onError: (error) => toast.error(detailOf(error) ?? "Failed to update role.") },
              )
            }
          >
            Save permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleBadge({ role }: { role: string }) {
  // Shown whole. The name used to be stripped of a `ROLE_` prefix that said nothing; what is left after
  // `{SCOPE}_{ROLE}` is the scope, and the scope is the half worth reading.
  const variant = role.endsWith("_ADMIN") || role.endsWith("_GOD") ? "destructive" : role.endsWith("_MANAGER") ? "default" : "secondary"

  return (
    <Badge variant={variant} className="font-mono text-[11px]">
      {role}
    </Badge>
  )
}

/**
 * A set of permissions, grouped by what they are about.
 *
 * ⚠️ The grouping is the whole of this component and it is not decoration. Seventy chips in one wrapped
 * block is a wall nobody reads to the end of; the same seventy under fourteen headings is a question
 * anybody can answer — *what may this role do to forms* — by looking at one line. The namespace appears
 * once, as the heading, so each chip carries only its verb.
 */
function PermissionGroups({ permissions }: { permissions: string[] }) {
  const byNamespace = new Map<string, string[]>()

  for (const permission of [...permissions].sort()) {
    const separator = permission.indexOf(":")
    const namespace = separator === -1 ? "—" : permission.slice(0, separator)
    const action = separator === -1 ? permission : permission.slice(separator + 1)

    byNamespace.set(namespace, [...(byNamespace.get(namespace) ?? []), action])
  }

  return (
    <div className="flex flex-col gap-1.5">
      {[...byNamespace].map(([namespace, actions]) => (
        <div key={namespace} className="flex flex-wrap items-baseline gap-1.5">
          <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">{namespace}</span>
          {actions.map((action) => (
            <span
              key={action}
              title={`${namespace}:${action}`}
              className="rounded border px-1.5 py-0.5 font-mono text-[11px]"
            >
              {action}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function RoleSelector({
  availableRoles,
  selected,
  onChange,
}: {
  availableRoles: string[]
  selected: string[]
  onChange: (roles: string[]) => void
}) {
  function toggle(role: string) {
    onChange(selected.includes(role) ? selected.filter((chosen) => chosen !== role) : [...selected, role])
  }

  return (
    <Field label="Roles">
      <div className="flex flex-wrap gap-1">
        {(availableRoles.length > 0 ? availableRoles : [...BUILT_IN_ROLES]).map((role) => (
          <ToggleChip key={role} active={selected.includes(role)} onClick={() => toggle(role)}>
            {role}
          </ToggleChip>
        ))}
      </div>
    </Field>
  )
}

/** ⚠️ Selection is by permission NAME — there are no permission rows to have identifiers. */
function PermissionSelector({
  permissions,
  selected,
  onChange,
}: {
  permissions: string[]
  selected: string[]
  onChange: (permissions: string[]) => void
}) {
  function toggle(permission: string) {
    onChange(selected.includes(permission) ? selected.filter((chosen) => chosen !== permission) : [...selected, permission])
  }

  return (
    <Field label={`Permissions · ${selected.length} of ${permissions.length}`}>
      {permissions.length === 0 ? (
        <p className="text-xs text-muted-foreground">This build declares no permissions.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {permissions.map((permission) => (
            <ToggleChip
              key={permission}
              className="font-mono"
              active={selected.includes(permission)}
              onClick={() => toggle(permission)}
            >
              {permission}
            </ToggleChip>
          ))}
        </div>
      )}
    </Field>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md border px-3 py-2">
      <span className="text-[11px] text-muted-foreground uppercase">{label}</span>
      <span className="truncate text-sm" title={value}>
        {value}
      </span>
    </div>
  )
}

function detailOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
}
