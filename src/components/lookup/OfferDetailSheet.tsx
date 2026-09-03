import {
  Badge,
  Button,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@jmouse/ui"
import type { LookupOffer } from "@/api/lookup"
import { formatPrice } from "./OfferCard"

/**
 * Everything the provider said about one part.
 *
 * ⚠️ **Only what it actually said.** A provider that returned no lead time and one that returned "in
 * stock" are different answers; a row of dashes for every field a provider does not carry teaches the
 * reader that this screen is mostly empty, which is not true of the next provider.
 */
export function OfferDetailSheet({
  offer,
  provider,
  onAdd,
  onClose,
}: {
  offer: LookupOffer
  provider: string
  onAdd?: () => void
  onClose: () => void
}) {
  const currency = offer.currency ?? "USD"

  const facts: Array<{ label: string; value: string | null }> = [
    { label: "Manufacturer", value: offer.manufacturer },
    { label: "Vendor SKU", value: offer.vendorSku },
    { label: "Category", value: offer.category },
    { label: "Status", value: offer.productStatus },
    { label: "RoHS", value: offer.rohs },
    { label: "Minimum order", value: offer.moq !== null && offer.moq !== undefined ? String(offer.moq) : null },
    { label: "Lead time", value: offer.leadTime },
    {
      label: "In stock",
      value: offer.stock !== null && offer.stock !== undefined ? offer.stock.toLocaleString() : null,
    },
  ].filter((fact) => fact.value)

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex flex-wrap items-center gap-2 font-mono text-sm">
            {offer.partNumber ?? "—"}
            <Badge variant="secondary">{provider}</Badge>
          </SheetTitle>
          <SheetDescription className="text-xs">
            {offer.manufacturer ?? "What this distributor holds and what it costs."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {offer.imageUrl && (
            <img
              src={offer.imageUrl}
              alt=""
              className="max-h-40 self-start rounded-md border bg-background object-contain p-2"
            />
          )}

          {(offer.detailedDescription || offer.description) && (
            <p className="text-sm">{offer.detailedDescription ?? offer.description}</p>
          )}

          {facts.length > 0 && (
            <RowGroup label="What the provider says">
              <RowList>
                {facts.map((fact) => (
                  <Row key={fact.label}>
                    <RowMeta>{fact.label}</RowMeta>
                    <RowTitle>{fact.value}</RowTitle>
                  </Row>
                ))}
              </RowList>
            </RowGroup>
          )}

          {offer.priceBreaks && offer.priceBreaks.length > 0 && (
            <RowGroup label="Price breaks" tally={currency}>
              <RowList>
                {offer.priceBreaks.map((priceBreak, index) => (
                  <Row key={index} trailing={<span className="font-mono text-xs">{index === 0 ? "cheapest lot" : ""}</span>}>
                    <span className="flex items-baseline gap-3">
                      <RowTitle className="font-mono">{priceBreak.quantity}+</RowTitle>
                      <RowMeta className="font-mono">
                        {currency} {formatPrice(priceBreak.unitPrice)}
                      </RowMeta>
                    </span>
                  </Row>
                ))}
              </RowList>
            </RowGroup>
          )}
        </div>

        <div className="flex items-center gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex-1" />
          {offer.buyUrl && (
            <Button variant="ghost" asChild>
              <a href={offer.buyUrl} target="_blank" rel="noreferrer">
                Buy ↗
              </a>
            </Button>
          )}
          {onAdd && <Button onClick={onAdd}>Record one</Button>}
        </div>
      </SheetContent>
    </Sheet>
  )
}
