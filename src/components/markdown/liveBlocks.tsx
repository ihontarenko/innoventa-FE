import { useMemo } from "react"
import type { DataBlockLoad, DataBlockRenderProperties, DataBlockRequest } from "@jmouse/markdown"
import { cn } from "@jmouse/ui"
import { ToggleChip } from "@/components/ToggleChip"
import { usePageBlocks } from "@/hooks/useBlocks"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { PageBlockResponse } from "@/api/blocks"
import {
  BlockCard,
  BlockNotice,
  BlockSkeleton,
  Fact,
  FactList,
  formatConstant,
  lifecycleTone,
} from "./BlockChrome"
import { surfaceResolution, type InnoventaMarkdownContext } from "./surface"

/**
 * The `:::` directives whose whole point is that they are **not** written down.
 *
 * ⚠️ **A bring-up log written in March still shows correct stock in September**, because the numbers are
 * read at view time rather than typed at write time. That is the entire reason this mechanism exists, and
 * it is what every decision below is protecting.
 *
 * The library owns the mechanism — claim the names, batch the document into one request, key the answers
 * back to their blocks. This file owns both ends: which endpoint answers (the surface decides) and what a
 * resolved block looks like.
 */

/**
 * Every directive the product has ever had a resolver for — what the **parser** recognises.
 *
 * ⚠️ **Deliberately wider than the served catalogue, and deliberately not derived from it.** The
 * catalogue answers *what may this workspace write*, which is about offering; this answers *what does
 * this text mean*, which is about reading, and the two must not be one list. A page shared in from a
 * workspace that counts stock — or one written before its module was switched off — still contains
 * `:::stock`, and it has to keep reading as a block that says it is unavailable rather than silently
 * reverting to prose.
 *
 * ⚠️ **Static, because reading happens where there is no catalogue to fetch**: a public share, an embed,
 * an inert preview.
 */
export const INNOVENTA_DATA_DIRECTIVES = [
  "part",
  "stock",
  "bom",
  "eseries",
  "alternates",
  "location",
  "datasheet",
] as const

/**
 * ⚠️ **Resolved through React Query, which is why this is a hook the product supplies** rather than the
 * library's own promise loader: the editor's live preview then re-uses a resolved block instead of
 * re-fetching it on every keystroke.
 */
export function useInnoventaBlocks(
  requests: readonly DataBlockRequest[],
  context: InnoventaMarkdownContext,
): DataBlockLoad<PageBlockResponse> {
  const resolution = surfaceResolution(context.surface)
  const { data, isLoading } = usePageBlocks(requests, resolution)

  return useMemo(
    () => ({
      results: data?.map((response) => ({
        name: response.name,
        argument: response.argument,
        data: response,
      })),
      loading: isLoading,
      available: resolution.mode !== "none",
    }),
    [data, isLoading, resolution.mode],
  )
}

/**
 * One resolved block, dispatched to its card.
 *
 * ⚠️ **Dispatched on the payload, not on the directive's name.** The server answers `:::part` with an
 * identity card on a public view and a linked card in-app out of one shape; branching on the name here
 * would put that decision in two places.
 */
export function InnoventaDataBlock({ block, data, status }: DataBlockRenderProperties<PageBlockResponse>) {
  if (status === "unavailable") {
    return <BlockNotice name={block.name} argument={block.body} status="RESTRICTED" />
  }

  if (status === "loading" || !data) {
    return <BlockSkeleton name={block.name} argument={block.body} />
  }

  if (data.status !== "RESOLVED") {
    return <BlockNotice name={data.name} argument={data.argument} status={data.status} />
  }

  if (data.part) {
    return <PartBlock part={data.part} />
  }

  if (data.stock) {
    return <StockBlock stock={data.stock} />
  }

  if (data.bom) {
    return <BomBlock bom={data.bom} />
  }

  if (data.eseries) {
    return <EseriesBlock eseries={data.eseries} />
  }

  if (data.alternates) {
    return <AlternatesBlock alternates={data.alternates} />
  }

  if (data.location) {
    return <LocationBlock location={data.location} />
  }

  if (data.datasheet) {
    return <DatasheetBlock datasheet={data.datasheet} />
  }

  return null
}

type Part = NonNullable<PageBlockResponse["part"]>
type Stock = NonNullable<PageBlockResponse["stock"]>
type Bom = NonNullable<PageBlockResponse["bom"]>
type Eseries = NonNullable<PageBlockResponse["eseries"]>
type Alternates = NonNullable<PageBlockResponse["alternates"]>
type Location = NonNullable<PageBlockResponse["location"]>
type Datasheet = NonNullable<PageBlockResponse["datasheet"]>

/**
 * ⚠️ **A workspace-relative address, and `undefined` when there is no workspace to be relative to.** A
 * page renders on a public share where nobody is inside a workspace; a link built anyway would 404 for
 * the one reader who most needs the page to work.
 */
function useEntryHref() {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  return (formId: string | null, entryId: string | null) =>
    spaceSlug && formId && entryId ? spaceSectionPath(spaceSlug, `entry/${formId}/${entryId}`) : undefined
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
      {children}
    </a>
  )
}

function PartBlock({ part }: { part: Part }) {
  const entryHref = useEntryHref()

  return (
    <BlockCard
      kind="Part"
      headline={part.partNumber}
      headlineHref={entryHref(part.formId, part.entryId)}
      trailing={
        part.lifecycle ? (
          <span className={cn("text-[11px] font-medium", lifecycleTone(part.lifecycle))}>{part.lifecycle}</span>
        ) : undefined
      }
    >
      <FactList>
        <Fact label="Manufacturer" value={part.manufacturer} />
        <Fact label="Package" value={part.packageName} />
        <Fact label="Class" value={formatConstant(part.componentClass)} />
      </FactList>

      {part.datasheetUrl && <ExternalLink href={part.datasheetUrl}>Datasheet ↗</ExternalLink>}
    </BlockCard>
  )
}

function StockBlock({ stock }: { stock: Stock }) {
  const entryHref = useEntryHref()

  return (
    <BlockCard kind="Stock" headline={stock.label} headlineHref={entryHref(stock.formId, stock.entryId)}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xl font-medium">{stock.quantity ?? "—"}</span>
        {/* ⚠️ "not tracked" and "zero" are different answers and are said differently. */}
        <span className="text-xs text-muted-foreground">
          {stock.quantity === null ? "quantity not tracked" : "on hand"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{stock.formName}</span>
      </div>
    </BlockCard>
  )
}

function BomBlock({ bom }: { bom: Bom }) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  return (
    <BlockCard
      kind="BOM"
      headline={bom.name}
      headlineHref={spaceSlug ? spaceSectionPath(spaceSlug, `projects/${bom.projectId}`) : undefined}
      trailing={<span className="font-mono text-xs">{bom.buildableQuantity} buildable</span>}
    >
      {/* ⚠️ The limiting material is the answer somebody came for. "Three buildable" is a number; "three,
          because you are out of the regulator" is a thing to act on. */}
      {bom.limitingMaterialLabel && (
        <p className="text-xs text-muted-foreground">
          Limited by <strong className="text-foreground">{bom.limitingMaterialLabel}</strong>
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-[10px] tracking-[0.05em] text-muted-foreground uppercase">
              <th className="py-1 pr-2 text-left font-medium">Ref</th>
              <th className="py-1 pr-2 text-left font-medium">Component</th>
              <th className="py-1 pr-2 text-right font-medium">Need</th>
              <th className="py-1 text-right font-medium">Have</th>
            </tr>
          </thead>

          <tbody>
            {bom.lines.map((line, index) => (
              <tr
                key={`${line.referenceDesignator ?? "line"}-${index}`}
                className={cn("border-b last:border-b-0", line.coverageStatus === "EXCLUDED" && "opacity-50")}
              >
                <td className="py-1 pr-2 font-mono">{line.referenceDesignator ?? "—"}</td>
                <td className="py-1 pr-2">{line.componentDescription}</td>
                <td className="py-1 pr-2 text-right font-mono">{line.quantityRequired}</td>
                {/* ⚠️ `?` rather than 0 — a material nobody has counted is not a material with none. */}
                <td className="py-1 text-right font-mono">{line.heldQuantity ?? "?"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockCard>
  )
}

function EseriesBlock({ eseries }: { eseries: Eseries }) {
  return (
    <BlockCard
      kind="E-series"
      headline={eseries.normalizedDisplay}
      trailing={
        <span className="font-mono text-xs text-muted-foreground">
          {eseries.bandLow} – {eseries.bandHigh}
        </span>
      }
    >
      {eseries.values.length === 0 ? (
        <p className="text-xs text-muted-foreground">No E24 standard value falls in that band.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {eseries.values.map((value) => (
            <ToggleChip key={value} active onClick={() => undefined}>
              {value}
            </ToggleChip>
          ))}
        </div>
      )}
    </BlockCard>
  )
}

function AlternatesBlock({ alternates }: { alternates: Alternates }) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  return (
    <BlockCard
      kind="Alternates"
      headline={alternates.partNumber}
      headlineHref={
        spaceSlug && alternates.entryId
          ? spaceSectionPath(spaceSlug, `inventory?entry=${alternates.entryId}`)
          : undefined
      }
    >
      {alternates.alternates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No alternate is recorded for this part.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {alternates.alternates.map((alternate, index) => (
            <li
              key={`${alternate.partNumber ?? "alt"}-${index}`}
              className="flex flex-wrap items-baseline gap-2 border-b py-1 text-xs last:border-b-0"
            >
              <span className="font-mono">{alternate.partNumber}</span>
              {alternate.kind && <span className="text-muted-foreground">{alternate.kind}</span>}
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  )
}

function LocationBlock({ location }: { location: Location }) {
  const entryHref = useEntryHref()

  return (
    <BlockCard kind="Location" headline={location.label} headlineHref={entryHref(location.formId, location.entryId)}>
      <p className="font-mono text-xs text-muted-foreground">{location.path ?? "No location set"}</p>
    </BlockCard>
  )
}

function DatasheetBlock({ datasheet }: { datasheet: Datasheet }) {
  return (
    <BlockCard kind="Datasheet" headline={datasheet.partNumber}>
      <ExternalLink href={datasheet.url}>
        Open datasheet{datasheet.page ? ` · p.${datasheet.page}` : ""} ↗
      </ExternalLink>
    </BlockCard>
  )
}
