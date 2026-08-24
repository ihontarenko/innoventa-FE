import { useState } from "react"
import { Badge, Row, RowGroup, RowList, RowMeta, RowTitle, Skeleton } from "@jmouse/ui"
import { AssetDrawer } from "@/components/custody/AssetDrawer"
import { NothingNeedsYou } from "@/components/custody/NothingNeedsYou"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { PageHeader } from "@/components/PageHeader"
import { useAttention } from "@/hooks/useAttention"
import { describeQueryFailure } from "@/lib/loadFailure"

/**
 * What needs somebody today.
 *
 * ⚠️ **This screen knows of no feature.** It receives groups with a label, and items with a title, a
 * detail, a weight and a subject — and it renders them. It does not know that one group is about
 * custody and another about servicing, which is why a fifth source will cost a bean in the feature that
 * owns the fact and nothing here. There is an architecture test on the backend that keeps its half of
 * that bargain.
 *
 * ⚠️ **A group a person may not see never arrives**, so a count here can never disagree with the list
 * under it. The filtering happens before the counting, on the server.
 *
 * ⚠️ **An empty board is a real answer, not an error.** "Nothing needs you" is what somebody opening
 * this in the morning is hoping to read, and it has to look like an answer rather than like a screen
 * that failed to load.
 */
export function AttentionPage() {
  const query = useAttention()
  const failure = describeQueryFailure(query, "attention")

  const [openAssetId, setOpenAssetId] = useState<string | null>(null)

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  const groups = query.data ?? []
  const total = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <>
      <PageHeader
        title="Attention"
        description="Everything the workspace thinks wants you, most urgent first."
      />

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : total === 0 ? (
        /* ⚠️ **A slot, not a sentence.** An empty board reads identically whether the workspace is calm
           or whether nobody ever configured anything, and for a new workspace it is the only thing the
           watch ever says. Which empty this is depends on the feature, and the feature is what answers —
           this screen still knows of none. */
        <NothingNeedsYou />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <RowGroup key={group.key} label={group.label} tally={`${group.items.length}`}>
              <RowList>
                {group.items.map((item) => (
                  <Row
                    key={`${group.key}:${item.subjectId}:${item.title}`}
                    // Every item leads to the thing that raised it, and to nowhere else. The action the
                    // item names is inside that drawer — which is what keeps this screen from growing
                    // its own copy of four features' buttons.
                    onOpen={() => item.subjectKind === "asset" && setOpenAssetId(item.subjectId)}
                    trailing={item.actionLabel ? <Badge variant="outline">{item.actionLabel}</Badge> : undefined}
                  >
                    <RowTitle>{item.title}</RowTitle>
                    <RowMeta>{item.detail}</RowMeta>
                  </Row>
                ))}
              </RowList>
            </RowGroup>
          ))}
        </div>
      )}

      {openAssetId && <AssetDrawer assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </>
  )
}
