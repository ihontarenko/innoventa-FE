import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge, PageState, Row, RowGroup, RowList, RowMeta, RowTitle } from "@jmouse/ui"
import { AssetSheet } from "@/components/custody/AssetPanel"
import { NothingNeedsYou } from "@/components/custody/NothingNeedsYou"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { PageHeader } from "@/components/PageHeader"
import { useAttention } from "@/hooks/useAttention"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
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
  const navigate = useNavigate()

  const [openAssetId, setOpenAssetId] = useState<string | null>(null)

  /**
   * ⚠️ **A row with nowhere to go is the one thing this screen must not have.** An item names its
   * subject in the publisher's own words, and each kind needs its own way there: an asset opens a
   * drawer, a position is an entry and needs its form as well as its id. That form is one per workspace
   * — the inventory form — so it is resolved here rather than carried on every item.
   */
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const { data: inventoryForms = [] } = useWorkspaceForms("INVENTORY")
  const inventoryFormId = inventoryForms[0]?.id ?? null

  function open(item: { subjectKind: string; subjectId: string }) {
    if (item.subjectKind === "asset") {
      setOpenAssetId(item.subjectId)
      return
    }
    if (item.subjectKind === "position" && spaceSlug && inventoryFormId) {
      navigate(spaceSectionPath(spaceSlug, `inventory/entry/${inventoryFormId}/${item.subjectId}`))
    }
  }

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

      {/* ⚠️ No error branch here, and that is not an omission: `describeQueryFailure` above returns
          early with `LoadFailureNotice`, which tells four kinds of failure apart — including the paused
          one, which looks like patience rather than like an error. A `PageState kind="error"` beside it
          would be a second, worse answer to the same question. */}
      {query.isLoading ? (
        <PageState kind="loading" rows={6} />
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
                    // item names is inside that drawer or on that record — which is what keeps this
                    // screen from growing its own copy of five features' buttons.
                    onOpen={() => open(item)}
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

      {openAssetId && <AssetSheet assetId={openAssetId} onClose={() => setOpenAssetId(null)} />}
    </>
  )
}
