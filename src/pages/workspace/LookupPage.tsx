import { useState } from "react"
import { toast } from "sonner"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { Callout } from "@/components/Callout"
import { EntryDetailDrawer } from "@/components/form/EntryDetailDrawer"
import { AddFromLookupDialog } from "@/components/lookup/AddFromLookupDialog"
import { OfferCard } from "@/components/lookup/OfferCard"
import { OfferDetailSheet } from "@/components/lookup/OfferDetailSheet"
import { usePricingSearch } from "@/hooks/usePricing"
import { useCreateEntry } from "@/hooks/useWorkspaceForms"
import type { PricingOffer } from "@/api/pricing"
import type { FormEntry } from "@/types"

/**
 * Which distributors this installation can ask.
 *
 * ⚠️ **A provider with no API key configured fails at the first search**, not at startup, and the message
 * comes back from the backend. Hiding one that is not configured would need this screen to know the
 * installation's secrets, which is exactly what it must not.
 */
const PROVIDERS = [
  { id: "mouser", label: "Mouser" },
  { id: "digikey", label: "DigiKey" },
]

/**
 * Somebody else's catalogue, asked live.
 *
 * ⚠️ **Nothing here is yours until you record it.** This screen reads a distributor's answer; the
 * workspace holds nothing as a result of looking. *Record one* is the only thing that writes, and even it
 * opens a form rather than saving — a lookup never knows the quantity, the shelf or what was actually
 * paid.
 *
 * ⚠️ **Searched on Enter, never as you type.** It is somebody's rate-limited and often paid API; a
 * request per keystroke is a bill per keystroke.
 */
export function LookupPage() {
  const [provider, setProvider] = useState(PROVIDERS[0].id)
  const [typed, setTyped] = useState("")
  const [query, setQuery] = useState("")

  const [detail, setDetail] = useState<PricingOffer | null>(null)
  const [adding, setAdding] = useState<PricingOffer | null>(null)
  const [prefilled, setPrefilled] = useState<{ formId: string; values: Record<string, string> } | null>(null)

  const { data, isFetching, isError, error } = usePricingSearch(provider, query, query.length > 0)
  const createEntry = useCreateEntry()

  const detailMessage = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail

  function run() {
    setQuery(typed.trim())
  }

  return (
    <>
      <PageHeader
        title="Lookup"
        description="Ask a distributor about a part — price, stock, datasheet. Nothing is yours until you record it."
        actions={
          <>
            <span className="flex gap-1">
              {PROVIDERS.map((one) => (
                <ToggleChip
                  key={one.id}
                  active={provider === one.id}
                  onClick={() => {
                    setProvider(one.id)
                    // ⚠️ The answer belonged to the provider that gave it. Keeping it on screen under a
                    // different provider's name is the one mistake this screen must not make.
                    setQuery("")
                  }}
                >
                  {one.label}
                </ToggleChip>
              ))}
            </span>

            <Input
              autoFocus
              className="h-8 w-72 font-mono text-sm"
              value={typed}
              placeholder="STM32F103C8T6"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && run()}
            />
            <Button size="sm" disabled={!typed.trim()} onClick={run}>
              Search
            </Button>
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-3">
        {isError && (
          <Callout tone="danger">
            <span>
              <strong>That search did not come back.</strong>{" "}
              {detailMessage ?? "The provider answered with an error. It may not be configured in this installation."}
            </span>
          </Callout>
        )}

        {isFetching ? (
          <Skeleton className="h-64 w-full" />
        ) : !query ? (
          <Empty
            title="Ask about a part"
            detail="Type a part number or a keyword and press Enter. Nothing is searched while you type — it is somebody else's API on the other end."
          />
        ) : data && data.offers.length === 0 ? (
          <Empty
            title="Nothing came back"
            detail={`${PROVIDERS.find((one) => one.id === provider)?.label ?? provider} has no offer for “${data.query}”. Try the other provider, or a shorter query.`}
          />
        ) : data ? (
          <>
            <span className="text-xs text-muted-foreground">
              {data.offers.length} offer{data.offers.length === 1 ? "" : "s"} for{" "}
              <span className="font-mono">{data.query}</span>
            </span>

            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {data.offers.map((offer, index) => (
                <OfferCard
                  key={`${offer.partNumber}-${index}`}
                  offer={offer}
                  onOpen={() => setDetail(offer)}
                  onAdd={() => setAdding(offer)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {detail && (
        <OfferDetailSheet
          offer={detail}
          provider={data?.provider ?? provider}
          onAdd={() => {
            setAdding(detail)
            setDetail(null)
          }}
          onClose={() => setDetail(null)}
        />
      )}

      {adding && (
        <AddFromLookupDialog
          offer={adding}
          onMapped={(formId, values) => {
            setPrefilled({ formId, values })
            setAdding(null)
          }}
          onClose={() => setAdding(null)}
        />
      )}

      {prefilled && (
        <EntryDetailDrawer
          formId={prefilled.formId}
          // ⚠️ A stand-in row carrying only the mapped values — `isNew` means nothing is written until
          // somebody submits, so the rest of the shape is never read.
          entry={{ fieldValues: prefilled.values } as FormEntry}
          isNew
          isSubmitting={createEntry.isPending}
          onSubmit={async (fieldValues) => {
            await createEntry.mutateAsync({ formId: prefilled.formId, fieldValues })
            toast.success("Recorded.")
            setPrefilled(null)
          }}
          onClose={() => setPrefilled(null)}
        />
      )}
    </>
  )
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
      <span aria-hidden="true" className="text-2xl">
        🔎
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="max-w-md text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}
