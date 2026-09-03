import { useState } from "react"
import { Badge, cn, Row, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { AssetSheet } from "@/components/custody/AssetPanel"
import { useAssets } from "@/hooks/useCustody"
import { relativeMoment, relativeTime } from "@/lib/dates"
import type { Holder } from "@/api/custody"

/**
 * One person, and everything they are carrying.
 *
 * ⚠️ **The list is the asset board asked one question.** `holderEntryId` is a filter the server has
 * always supported, so this panel runs the same query the Assets screen runs and shows the same rows —
 * rather than a second listing of things with its own idea of what a thing is.
 *
 * ⚠️ **Open possessions only.** What somebody had in March is the *asset's* history, and it lives in
 * the asset panel where every other movement does. A person's page that tried to be a second history
 * would answer the same question twice and disagree with itself the first time a thing was transferred.
 *
 * ⚠️ **A body, not a sheet.** It was a `Sheet` that dimmed the list behind it, while Inventory showed
 * the same kind of thing as a third full-height column. The heading, the ✕ and the column-or-overlay
 * decision belong to `DetailsPanel`; this file supplies only what is inside it.
 */
export function HolderPanel({ holder }: { holder: Holder }) {
  const { data, isLoading } = useAssets({ holderEntryId: holder.entryId }, 0, 100)
  const [openAssetId, setOpenAssetId] = useState<string | null>(null)

  const assets = data?.content ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : assets.length === 0 ? (
        <p className="text-muted-foreground border border-dashed px-4 py-8 text-center text-sm">
          Carrying nothing right now.
        </p>
      ) : (
        <RowList>
          {assets.map((asset) => (
            <Row
              key={asset.id}
              onOpen={() => setOpenAssetId(asset.id)}
              className={cn(asset.overdue && "border-l-destructive bg-destructive/5 border-l-2")}
              leading={<span aria-hidden="true">→</span>}
              trailing={
                asset.overdue ? (
                  <Badge variant="destructive">overdue</Badge>
                ) : asset.dueAt ? (
                  <Badge variant="outline">due {relativeMoment(asset.dueAt)}</Badge>
                ) : undefined
              }
            >
              <RowTitle>{asset.label}</RowTitle>
              <RowMeta>
                {asset.formName}
                {asset.issuedAt ? ` · taken ${relativeTime(asset.issuedAt)}` : ""}
              </RowMeta>
            </Row>
          ))}
        </RowList>
      )}

      {/* ⚠️ Layered over this panel rather than replacing it: returning a thing is done from the asset,
          and somebody working through what one person carries wants the list still there when they come
          back out of it. */}
      {openAssetId && <AssetSheet assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </div>
  )
}
