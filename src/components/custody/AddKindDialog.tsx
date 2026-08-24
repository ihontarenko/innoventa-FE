import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@jmouse/ui"
import { useApplyEquipmentSeed, useEquipmentSeeds } from "@/hooks/useMonitoring"
import type { OfferedKind } from "@/api/monitoring"

/**
 * Ready-made kinds of thing, so a workspace does not start from a blank form.
 *
 * ⚠️ **A starting point, never an opinion.** Nothing is seeded on workspace creation, on first entry or
 * on a schedule — somebody picks a kind and gets exactly what the card says. That distinction is what
 * lets the catalogue grow without anybody's workspace changing under them.
 *
 * ⚠️ **The card says what it will write, before it writes it.** A seed that landed and then had to be
 * explained is a seed somebody undoes; the metrics and rules are named on the card so the decision is
 * made with them in view.
 *
 * ⚠️ **Taking one twice adds nothing twice.** The backend skips a metric whose code is there and a rule
 * whose name is there, and answers with what it actually wrote — which is what the toast reports rather
 * than a cheerful "done".
 */
export function AddKindDialog({ onClose }: { onClose: () => void }) {
  const { data: kinds = [], isLoading } = useEquipmentSeeds()
  const apply = useApplyEquipmentSeed()

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a kind of thing</DialogTitle>
          <DialogDescription>
            A form describing it, the numbers worth collecting about it, and the rules that make one fall
            due — written into this workspace, then yours to change.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex flex-col gap-2">
            {kinds.map((kind) => (
              <KindCard
                key={kind.code}
                kind={kind}
                isBusy={apply.isPending}
                onTake={() =>
                  apply.mutate(kind.code, {
                    onSuccess: (applied) => {
                      toast.success(describe(kind, applied.plansAdded, applied.formPlaced))
                      onClose()
                    },
                    onError: () => toast.error("That kind was not added."),
                  })
                }
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function describe(kind: OfferedKind, plansAdded: number, formPlaced: boolean) {
  if (!formPlaced && plansAdded === 0) {
    return `${kind.name} was already here — nothing to add.`
  }

  return `${kind.name} added${plansAdded > 0 ? `, with ${plansAdded} ${plansAdded === 1 ? "rule" : "rules"}` : ""}.`
}

function KindCard({
  kind,
  isBusy,
  onTake,
}: {
  kind: OfferedKind
  isBusy: boolean
  onTake: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-lg leading-none">
          {kind.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{kind.name}</p>
          <p className="text-xs text-muted-foreground">{kind.description}</p>
        </div>

        {/* ⚠️ Present is said, not hidden. A kind removed from the list once taken would make the
            catalogue look shorter every time somebody used it, and leave "did that work?" unanswered. */}
        {kind.present ? (
          <Badge variant="secondary">already here</Badge>
        ) : (
          <Button size="sm" disabled={isBusy} onClick={onTake}>
            Add it
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {kind.metrics.map((metric) => (
          <Badge key={metric} variant="outline">
            measures {metric}
          </Badge>
        ))}
        {kind.plans.map((plan) => (
          <Badge key={plan} variant="outline">
            {plan}
          </Badge>
        ))}
      </div>
    </div>
  )
}
