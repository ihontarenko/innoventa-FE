import { useState } from "react"
import {
  Badge,
  cn,
  Row,
  RowList,
  RowMeta,
  RowTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@jmouse/ui"
import { AssetDrawer } from "@/components/custody/AssetDrawer"
import { useAssets } from "@/hooks/useCustody"
import { relativeMoment, relativeTime } from "@/lib/dates"
import type { Holder } from "@/api/custody"

/**
 * One person, and everything they are carrying.
 *
 * ⚠️ **The list is the asset board asked one question.** `holderEntryId` is a filter the server has
 * always supported, so this drawer runs the same query the Assets screen runs and shows the same rows —
 * rather than a second listing of things with its own idea of what a thing is.
 *
 * ⚠️ **Open possessions only.** What somebody had in March is the *asset's* history, and it lives in
 * the asset drawer where every other movement does. A person's page that tried to be a second history
 * would answer the same question twice and disagree with itself the first time a thing was transferred.
 */
export function HolderDrawer({ holder, onClose }: { holder: Holder; onClose: () => void }) {
  const { data, isLoading } = useAssets({ holderEntryId: holder.entryId }, 0, 100)
  const [openAssetId, setOpenAssetId] = useState<string | null>(null)

  const assets = data?.content ?? []

  return (
    <>
      <Sheet open onOpenChange={(next) => !next && onClose()}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{holder.label}</SheetTitle>
            <SheetDescription>
              {holder.formName}
              {holder.overdue > 0 && ` · ${holder.overdue} overdue`}
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : assets.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Carrying nothing right now.
            </p>
          ) : (
            <RowList>
              {assets.map((asset) => (
                <Row
                  key={asset.id}
                  onOpen={() => setOpenAssetId(asset.id)}
                  className={cn(asset.overdue && "border-l-2 border-l-destructive bg-destructive/5")}
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
        </SheetContent>
      </Sheet>

      {/* ⚠️ Layered over this drawer rather than replacing it: returning a thing is done from the
          asset, and somebody working through what one person carries wants the list still there when
          they come back out of it. */}
      {openAssetId && <AssetDrawer assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </>
  )
}
