import { Badge, Button, cn } from "@jmouse/ui"
import type { LookupOffer } from "@/api/lookup"

/** ⚠️ Two decimals is wrong for a part that costs 0.0032 — a price of "0.00" reads as free. */
export function formatPrice(amount: number): string {
  return amount < 0.01 ? amount.toFixed(5) : amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
}

/**
 * One distributor's answer about one part.
 *
 * ⚠️ **The best break is the *first* one, and it is the smallest quantity.** Somebody buying a handful
 * pays that; showing the thousand-off price as "the price" is the single most misleading thing this card
 * could do.
 *
 * ⚠️ **Stock of zero is said, not omitted.** "Out of stock" and "the provider did not say" are different
 * answers, and only one of them means order it somewhere else.
 */
export function OfferCard({
  offer,
  onOpen,
  onAdd,
}: {
  offer: LookupOffer
  onOpen: () => void
  onAdd?: () => void
}) {
  const currency = offer.currency ?? "USD"
  const best = offer.priceBreaks?.[0]

  return (
    <div className="group/offer flex flex-col gap-2 rounded-md border p-3 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-mono text-sm font-medium">{offer.partNumber ?? "—"}</span>
          {offer.manufacturer && <span className="truncate text-xs text-muted-foreground">{offer.manufacturer}</span>}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {best ? (
            <span className="font-mono text-sm font-medium">
              {currency} {formatPrice(best.unitPrice)}
              <span className="text-muted-foreground">/ea</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Price on request</span>
          )}

          {offer.stock !== null && offer.stock !== undefined && (
            <span className={cn("text-[11px]", offer.stock === 0 ? "text-destructive" : "text-muted-foreground")}>
              {offer.stock === 0 ? "Out of stock" : `${offer.stock.toLocaleString()} in stock`}
            </span>
          )}
        </div>
      </div>

      {offer.description && <p className="line-clamp-2 text-xs text-muted-foreground">{offer.description}</p>}

      {offer.priceBreaks && offer.priceBreaks.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {offer.priceBreaks.slice(0, 8).map((priceBreak, index) => (
            <span
              key={index}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                index === 0 && "border-primary/50",
              )}
            >
              {priceBreak.quantity}+ · {formatPrice(priceBreak.unitPrice)}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Details
        </Button>

        {onAdd && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            Record one
          </Button>
        )}

        <span className="ml-auto flex items-center gap-2">
          {offer.rohs && <Badge variant="outline">{offer.rohs}</Badge>}
          {offer.buyUrl && (
            <a
              href={offer.buyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline"
            >
              Buy ↗
            </a>
          )}
          {offer.dataSheetUrl && (
            <a
              href={offer.dataSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline"
            >
              Datasheet ↗
            </a>
          )}
        </span>
      </div>
    </div>
  )
}
