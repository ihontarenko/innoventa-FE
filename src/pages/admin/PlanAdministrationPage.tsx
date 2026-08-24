import { useState } from "react"
import { Link } from "react-router-dom"
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { GrantLine, UsageMeter } from "@/components/entitlement/EntitlementViews"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import {
  useAdministeredOrganization,
  useAdministeredOrganizations,
  useAssignPlan,
  useEndTrial,
  usePlanCatalogue,
  useStartTrial,
} from "@/hooks/useEntitlements"
import { readableDate } from "@/lib/dates"
import type { AdministeredOrganization, Plan } from "@/api/entitlements"

/**
 * The plan catalogue, and which organisation is on what.
 *
 * Everything that decides what a customer has paid for happens here: putting an organisation on a plan,
 * starting a trial, ending one. Gated on `plan:administer` and on nothing else — deciding what somebody
 * has bought is not implied by being able to administer users, workspaces or settings, so it is its own
 * power with its own permission.
 *
 * ⚠️ **No money passes through this screen.** The catalogue is administered by hand; wiring it to a
 * payment provider is a later integration against the model this cluster decided, which is why there is
 * no price anywhere on it.
 */
export function PlanAdministrationPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: plans = [], isLoading: plansLoading } = usePlanCatalogue()
  const { data: organizations = [], isLoading: organizationsLoading } = useAdministeredOrganizations()

  return (
    <>
      <PageHeader title="Plans" description="What each tier includes, and which account is on it" />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">The catalogue</h2>
          <p className="max-w-3xl text-xs text-muted-foreground">
            A plan is a bundle of grants. Putting an organisation on one issues those grants; taking it off withdraws
            them and touches nothing else — which is why a gift or a trial survives a plan change.
          </p>

          {/* ⚠️ Two sentences, and neither is decoration.
              The first is where a tier LIVES: read from the policy document, so this screen has no "new
              plan" button and should not grow one — editing a tier is editing that document, with a
              diff, a dry run and a revert behind it.
              The second is the one an administrator gets wrong: grants are materialised at the MOMENT OF
              ASSIGNMENT and are rows from then on. Without it somebody edits Business, sees the card
              change, and believes every customer on Business now has what they just added. */}
          <p className="max-w-3xl text-xs text-muted-foreground">
            Which tiers exist and what each includes is declared in the{" "}
            <Link to="/admin/access?view=plans" className="underline underline-offset-2">
              policy document
            </Link>
            , not stored here — so a change to a tier is versioned, can be rehearsed before it takes effect, and can be
            reverted. <strong>Editing a tier does not reissue it.</strong> Accounts already on it keep exactly the
            grants they were given; a change reaches the next account put on that tier.
          </p>

          {plansLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Who is on what</h2>
          {organizationsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <OrganizationTable organizations={organizations} onOpen={setOpenId} />
          )}
        </section>
      </div>

      {openId && <OrganizationPlanDialog organizationId={openId} plans={plans} onClose={() => setOpenId(null)} />}
    </>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{plan.name}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{plan.code}</div>
      </div>
      {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
      <ul className="flex flex-col gap-0.5">
        {plan.includes.map((line) => (
          <li key={line.capability} className="text-xs">
            · {line.words}
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrganizationTable({
  organizations,
  onOpen,
}: {
  organizations: AdministeredOrganization[]
  onOpen: (organizationId: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisation</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Trial</TableHead>
            <TableHead>Workspaces</TableHead>
            <TableHead>People</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((organization) => (
            <TableRow key={organization.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{organization.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{organization.slug}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">{organization.ownerEmail}</TableCell>

              {/* ⚠️ A tier is read off the account's own grants now rather than a column, so "on no
                  tier" is a real answer: an account whose plan grants were all withdrawn has none.
                  Printing the absence beats printing an empty badge, and beats inventing "Free" — which
                  would be this screen asserting something nobody granted. */}
              <TableCell>
                {organization.planName ? (
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {organization.planName}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">on no plan</span>
                )}
              </TableCell>

              {/* A trial says when it ends on every screen it appears on, from the day it starts. A
                  trial whose expiry is a surprise is a support ticket that was designed in. */}
              <TableCell>
                {organization.trialUntil ? (
                  <Badge>until {readableDate(organization.trialUntil)}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell className="font-mono text-xs">{organization.spaceCount}</TableCell>
              <TableCell className="font-mono text-xs">{organization.seatCount}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onOpen(organization.id)}>
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

/** One organisation: what it is on, what it holds, how much it has used, and how to change any of it. */
function OrganizationPlanDialog({
  organizationId,
  plans,
  onClose,
}: {
  organizationId: string
  plans: Plan[]
  onClose: () => void
}) {
  const { data: organizationPlan, isLoading } = useAdministeredOrganization(organizationId)

  const assignPlan = useAssignPlan()
  const startTrial = useStartTrial()
  const endTrial = useEndTrial()

  // ⚠️ Two selects, two states. One backed both for a while, so choosing a plan to trial silently armed
  // the Move button beside it — and moving an organisation between plans is not a thing to arm by
  // accident.
  const [movePlan, setMovePlan] = useState("")
  const [trialPlan, setTrialPlan] = useState("")
  const [trialUntil, setTrialUntil] = useState("")
  const [confirmingTrialEnd, setConfirmingTrialEnd] = useState(false)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] sm:max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{organizationPlan?.organizationName ?? "Organisation"}</DialogTitle>
          <DialogDescription>What this account is on, what it holds, and how much of it is used.</DialogDescription>
        </DialogHeader>

        {isLoading || !organizationPlan ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Plan</h3>
              <p className="text-xs text-muted-foreground">
                On <strong>{organizationPlan.plan.name}</strong>. Changing a plan re-issues its own grants and touches
                no grant of any other source — a gift, a purchase and a running trial all survive it.
              </p>

              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-48 flex-col gap-1">
                  <span className="text-xs font-medium">Move to</span>
                  <PlainSelect value={movePlan} onChange={setMovePlan}>
                    <option value="">Choose a plan…</option>
                    {plans
                      .filter((plan) => plan.code !== organizationPlan.plan.code)
                      .map((plan) => (
                        <option key={plan.code} value={plan.code}>
                          {plan.name}
                        </option>
                      ))}
                  </PlainSelect>
                </label>
                <Button
                  disabled={!movePlan || assignPlan.isPending}
                  onClick={() =>
                    assignPlan.mutate(
                      { organizationId, planCode: movePlan },
                      {
                        onSuccess: (plan) => {
                          toast.success(`Now on ${plan.plan.name}.`)
                          setMovePlan("")
                        },
                      },
                    )
                  }
                >
                  Move
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Trial</h3>

              {organizationPlan.trialUntil ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    A trial is running until {readableDate(organizationPlan.trialUntil)}. Ending it early leaves
                    whatever the plan already allowed.
                  </p>
                  {confirmingTrialEnd ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={endTrial.isPending}
                      onClick={() =>
                        endTrial.mutate(
                          { organizationId },
                          {
                            onSuccess: () => {
                              toast.success("Trial ended.")
                              setConfirmingTrialEnd(false)
                            },
                          },
                        )
                      }
                    >
                      Really end it — what it covers falls back to the plan
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setConfirmingTrialEnd(true)}>
                      End trial
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-48 flex-col gap-1">
                    <span className="text-xs font-medium">Try</span>
                    <PlainSelect value={trialPlan} onChange={setTrialPlan}>
                      <option value="">Choose a plan…</option>
                      {plans.map((plan) => (
                        <option key={plan.code} value={plan.code}>
                          {plan.name}
                        </option>
                      ))}
                    </PlainSelect>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium">Until</span>
                    <Input
                      className="h-8 text-sm"
                      type="date"
                      value={trialUntil}
                      onChange={(event) => setTrialUntil(event.target.value)}
                    />
                  </label>
                  <Button
                    disabled={!trialPlan || !trialUntil || startTrial.isPending}
                    onClick={() =>
                      startTrial.mutate(
                        {
                          organizationId,
                          planCode: trialPlan,
                          // The backend refuses a date that is not in the future, so end-of-day is what
                          // "until the 12th" has to mean.
                          until: `${trialUntil}T23:59:59`,
                        },
                        {
                          onSuccess: () => {
                            toast.success("Trial started.")
                            setTrialPlan("")
                            setTrialUntil("")
                          },
                        },
                      )
                    }
                  >
                    Start trial
                  </Button>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Usage</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {organizationPlan.usage.map((usage) => (
                  <UsageMeter key={usage.capability} usage={usage} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Grants</h3>
              <p className="text-xs text-muted-foreground">
                Every source together, and distinguishable. Somebody who was given something must be able to see that
                they were, or they will assume it is included and be wrong later.
              </p>
              <div className="flex flex-col gap-1.5">
                {organizationPlan.grants.map((grant) => (
                  <GrantLine key={grant.id} grant={grant} />
                ))}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
