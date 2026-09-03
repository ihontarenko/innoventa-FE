import { Link } from "react-router-dom"
import { Badge, Skeleton } from "@jmouse/ui"
import { usePartStock } from "@/hooks/useStock"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * Every box this part sits in, and how many are in each.
 *
 * <h2>⚠️ The question a part card could not answer before</h2>
 *
 * A part is an identity — what a component *is* — and carries no quantity at all. What is held of it is
 * the sum over every position naming it, which is a question about other records entirely. Without this
 * pane a catalogue row said what a component was and nothing about whether there was one in the
 * building, and somebody had to search the inventory by hand to find out.
 *
 * ⚠️ **Each row leads to the box, and each place leads to the place.** The epic's rule — no row without
 * a way out — is what makes a graph navigable rather than a set of tables that happen to share ids.
 */
export function WhereItIsPane({ partId }: { partId: string }) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const query = usePartStock(partId)

  /**
   * ⚠️ **A record is addressed by its form AND its id**, and a position only carries the second here.
   * The inventory form is one per workspace, so it is resolved once rather than carried on every row —
   * and a workspace that has not been given one yet simply offers no link, which is honest: there is
   * nowhere for the row to go.
   */
  const { data: inventoryForms = [] } = useWorkspaceForms("INVENTORY")
  const inventoryFormId = inventoryForms[0]?.id ?? null

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const stock = query.data
  const positions = stock?.positions ?? []

  if (positions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        None of these are held anywhere. The catalogue records what a component is, whether or not one is
        in a drawer — this is the second half, and it is empty until somebody puts one on a shelf.
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono font-medium text-foreground">{stock?.totalQuantity ?? 0}</span> held
        across {positions.length === 1 ? "one place" : `${positions.length} places`}.
      </p>

      <div className="min-w-0 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
              <th className="px-2.5 py-1.5 text-left font-medium">Where</th>
              <th className="px-2.5 py-1.5 text-right font-medium">How many</th>
              <th className="w-px px-2.5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={position.entryId} className="border-b last:border-b-0">
                <td className="px-2.5 py-1.5">
                  {position.locationPath ?? (
                    <span className="text-muted-foreground">nowhere in particular</span>
                  )}
                </td>

                {/* ⚠️ A dash rather than a zero where nobody has counted it. A box with none in it and a
                    box nobody has opened are different facts about the shelf. */}
                <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                  {/* ⚠️ `== null`, catching undefined as well: a nullable backend field is OMITTED by
                      `non_null` serialisation rather than sent as null, so `=== null` is silently
                      always false and an uncounted box would print `undefined`. */}
                  {position.quantity == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : position.quantity === 0 ? (
                    <Badge variant="outline" className="text-[10px]">
                      none
                    </Badge>
                  ) : (
                    position.quantity
                  )}
                </td>

                <td className="px-2.5 py-1.5 text-right">
                  {spaceSlug && inventoryFormId && (
                    <Link
                      to={spaceSectionPath(
                        spaceSlug,
                        `inventory/entry/${inventoryFormId}/${position.entryId}`,
                      )}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      open
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
