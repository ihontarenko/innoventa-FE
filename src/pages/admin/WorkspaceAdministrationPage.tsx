import { useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Row,
  RowAction,
  RowMeta,
  RowTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { GrantLine } from "@/components/entitlement/EntitlementViews"
import {
  useAdministeredSpace,
  useAdministeredSpaces,
  useReleaseCapability,
  useWithholdCapability,
} from "@/hooks/useEntitlements"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { AdministeredSpace, SpaceModule } from "@/api/entitlements"

/**
 * Every workspace in the installation, for whoever governs them.
 *
 * ⚠️ **The difference between this and the workspace list is the whole reason it exists**, and the
 * reason it needs a permission of its own: it lists workspaces the reader is not a member of. A space
 * is L0, so administering one is platform work, sitting beside Users, Invitations, System settings and
 * Sharing.
 *
 * **Withhold** and **Give back** live here, and nowhere else. They used to sit on a workspace's own
 * settings screen, which meant an administrator and a member opened one address and saw two different
 * screens — one a settings page, the other a governance console. This screen governs; that one chooses.
 */
export function WorkspaceAdministrationPage() {
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  // ⚠️ Debounced: every keystroke here is a query over the whole installation, and each one is an
  // administrative read somebody may have to account for later.
  const debouncedSearch = useDebouncedValue(search, 250)
  const { data: spaces = [], isLoading } = useAdministeredSpaces(debouncedSearch || undefined)

  return (
    <>
      <PageHeader title="All workspaces" description="Every workspace in the installation, and what it holds" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* Searchable because an installation is not a page: name, slug and the organisation are what
              a support conversation actually starts from. */}
          <Input
            className="h-8 w-72 text-sm"
            value={search}
            placeholder="Workspace, slug or organisation…"
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            {spaces.length} {spaces.length === 1 ? "workspace" : "workspaces"}
          </span>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
            <span aria-hidden="true" className="text-2xl">
              ⊞
            </span>
            <span className="text-sm font-medium">Nothing matches</span>
            <span className="text-xs text-muted-foreground">No workspace in this installation answers to that.</span>
          </div>
        ) : (
          <WorkspaceTable spaces={spaces} onOpen={setOpenId} />
        )}
      </div>

      {openId && <WorkspaceDetailDialog spaceId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

function WorkspaceTable({ spaces, onOpen }: { spaces: AdministeredSpace[]; onOpen: (spaceId: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workspace</TableHead>
            <TableHead>Counts</TableHead>
            <TableHead>Organisation</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="w-20">People</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {spaces.map((space) => (
            <TableRow key={space.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{space.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{space.slug}</span>
                </div>
              </TableCell>
              {/* What it counts decides which modules it has at all, so it is the first thing to check
                  when somebody reports one missing. */}
              <TableCell className="text-xs">{space.subjectAreaLabel}</TableCell>
              <TableCell className="text-xs">{space.organizationName}</TableCell>
              <TableCell>
                {space.planName ? (
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {space.planName}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">on no plan</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{space.ownerDisplayName || space.ownerEmail}</TableCell>
              <TableCell className="font-mono text-xs">{space.memberCount}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onOpen(space.id)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** One workspace opened: what it is, how each module stands, and what it holds. */
function WorkspaceDetailDialog({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const { data: detail, isLoading } = useAdministeredSpace(spaceId)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{detail?.space.name ?? "Workspace"}</DialogTitle>
          <DialogDescription>What this workspace is, how each module stands, and what it holds.</DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Fact label="Counts" value={detail.space.subjectAreaLabel} />
              <Fact label="Organisation" value={detail.space.organizationName} />
              {/* An account on no tier is a real state now, not a missing value. */}
              <Fact label="Plan" value={detail.space.planName ?? "on no plan"} />
              <Fact label="Owner" value={detail.space.ownerDisplayName || detail.space.ownerEmail} />
              <Fact label="People" value={String(detail.space.memberCount)} />
              <Fact label="Discoverable" value={detail.space.discoverable ? "Yes" : "No"} />
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Modules</h3>
              <p className="text-xs text-muted-foreground">
                Withholding takes the decision away from the workspace, and everyone in it is shown the reason you
                write. It is not the same as switching a module off — that is theirs to undo, and this is not.
              </p>
              <div className="flex flex-col gap-1.5">
                {detail.modules.map((module) => (
                  <AdministeredModuleRow key={module.key} spaceId={spaceId} module={module} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Grants</h3>
              <p className="text-xs text-muted-foreground">
                Everything this workspace resolves through — its own, and its account's. Most of the answer to{" "}
                <em>why does this workspace have what it has</em> is the plan, so a list of only the workspace's own
                made a withheld module look like the only decision anybody had ever taken.
              </p>
              {detail.grants.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing at all — not even a plan.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {detail.grants.map((grant) => (
                    <GrantLine key={grant.id} grant={grant} scope="subject" />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

/**
 * One module, with the two governance controls this screen exists to hold.
 *
 * A module the workspace's own subject area does not carry never appears — there is nothing to withhold,
 * and a control for it would be a decision about something that does not exist here.
 */
function AdministeredModuleRow({ spaceId, module }: { spaceId: string; module: SpaceModule }) {
  const [withholding, setWithholding] = useState(false)
  const [reason, setReason] = useState("")

  const withhold = useWithholdCapability()
  const release = useReleaseCapability()

  const isWithheld = module.entitlement?.verdict === "WITHHELD"

  function submitWithholding(event: React.FormEvent) {
    event.preventDefault()

    withhold.mutate(
      { spaceId, capability: module.key, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`${module.name} is no longer this workspace's to switch.`)
          setWithholding(false)
          setReason("")
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Row
        tone={isWithheld ? "danger" : undefined}
        leading={<span aria-hidden="true">{isWithheld ? "⊘" : "◈"}</span>}
        trailing={
          <>
            {module.enabled && <Badge variant="secondary">on</Badge>}

            {isWithheld ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={release.isPending}
                onClick={() =>
                  release.mutate(
                    { spaceId, capability: module.key },
                    { onSuccess: () => toast.success(`${module.name} is this workspace's decision again.`) },
                  )
                }
              >
                Give back
              </Button>
            ) : (
              <RowAction>
                <Button variant="ghost" size="sm" onClick={() => setWithholding(!withholding)}>
                  {withholding ? "Cancel" : "Withhold"}
                </Button>
              </RowAction>
            )}
          </>
        }
      >
        <RowTitle>{module.name}</RowTitle>
        {module.entitlement?.words && <RowMeta>{module.entitlement.words}</RowMeta>}
      </Row>

      {/* The reason is the point, so there is nowhere to withhold a module without writing one. */}
      {withholding && (
        <form className="flex items-center gap-2 pl-8" onSubmit={submitWithholding}>
          <Input
            autoFocus
            className="h-8 flex-1 text-sm"
            value={reason}
            maxLength={500}
            placeholder={`Why is ${module.name} not available here?`}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={withhold.isPending || !reason.trim()}>
            Withhold
          </Button>
        </form>
      )}
    </div>
  )
}
