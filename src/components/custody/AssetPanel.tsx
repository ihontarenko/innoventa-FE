import { useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  cn,
  Input,
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
  Skeleton,
  Textarea,
} from "@jmouse/ui"
import { AssetInspections } from "@/components/custody/AssetInspections"
import { AssetMaintenance } from "@/components/custody/AssetMaintenance"
import { AssetReadings } from "@/components/custody/AssetReadings"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import {
  useAsset,
  useCustodyConditions,
  useHolders,
  useIssueAsset,
  useReturnAsset,
  useTransferAsset,
  useWriteOffAsset,
} from "@/hooks/useCustody"
import { useMonitoringModule } from "@/hooks/useMonitoring"
import { useStorageLocations } from "@/hooks/useStorageLocations"
import { readableMoment, relativeTime } from "@/lib/dates"
import type { StorageLocation } from "@/api/storageLocations"

type Movement = "issue" | "return" | "transfer" | "write-off"
/**
 * One thing, and everywhere it has been.
 *
 * ⚠️ **The history is the point of this screen, not a footnote.** Custody exists so somebody can answer
 * "who had it in March" — a panel that showed only the current holder would be a field on the entry, and
 * would not need a panel at all.
 *
 * ⚠️ **Which movements are offered follows the state, and that is the whole rule.** Something on a shelf
 * can be issued; something out can be returned or transferred; something written off can do neither.
 * Offering all four always would mean three refusals for every action.
 *
 * ⚠️ **A body, not a sheet.** It was a `Sheet` — a modal that dimmed the list behind it — while Inventory
 * showed the same kind of thing as a third column beside the rows. Ivan called that out in as many
 * words: *«вилазить збоку якесь гівно а не так як на інвентарі»*. The chrome (the heading, the ✕, the
 * column-or-overlay decision) belongs to `DetailsPanel`, which is what every list in this product now
 * opens; this file supplies only what is inside it.
 */
export function AssetPanel({ assetId }: { assetId: string }) {
  const { data, isLoading } = useAsset(assetId)
  const [movement, setMovement] = useState<Movement | null>(null)

  const watchesEquipment = useMonitoringModule()

  const asset = data?.asset

  const canIssue = asset?.state === "AVAILABLE"
  const canReturn = asset?.state === "ISSUED" || asset?.state === "IN_SERVICE"
  const canTransfer = asset?.state === "ISSUED"
  const isClosed = asset?.state === "WRITTEN_OFF"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
        {movement ? (
          <MovementForm
            assetId={assetId}
            movement={movement}
            onDone={() => setMovement(null)}
            onCancel={() => setMovement(null)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {canIssue && <Button size="sm" onClick={() => setMovement("issue")}>Issue it</Button>}
            {canReturn && (
              <Button size="sm" variant="outline" onClick={() => setMovement("return")}>
                Take it back
              </Button>
            )}
            {canTransfer && (
              <Button size="sm" variant="outline" onClick={() => setMovement("transfer")}>
                Hand it on
              </Button>
            )}
            {!isClosed && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setMovement("write-off")}
              >
                Write it off
              </Button>
            )}
            {isClosed && (
              <p className="text-xs text-muted-foreground">
                Written off — off the books, and kept only for its history.
              </p>
            )}
          </div>
        )}

        {/* ⚠️ Above the history and below the movements, which is where it belongs in the
            reading order: what state is it in now, then where has it been. Absent entirely
            where the workspace does not watch its things — the drawer exists everywhere, the
            watch is a paid module most workspaces do not have. */}
        {watchesEquipment && (
          <>
            {/* ⚠️ Due first, readings second, inspections third — the order somebody scans in:
                what needs doing, what the numbers say, what was checked. */}
            <AssetMaintenance assetId={assetId} />
            <AssetReadings assetId={assetId} />
            <AssetInspections assetId={assetId} />
          </>
        )}

        <RowGroup label="Where it has been" tally={`${data.history.length}`}>
          {data.history.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Nothing recorded yet — it has been where it was registered ever since.
            </p>
          ) : (
            <RowList>
              {data.history.map((entry) => (
                <Row
                  key={entry.id}
                  // ⚠️ The open one is marked, because "who has it now" is the question people
                  // scan a history for — and it is the row with no return date, which is easy to
                  // miss among ten.
                  className={cn(!entry.returnedAt && "border-l-2 border-l-primary bg-primary/5")}
                  trailing={
                    entry.overdue ? (
                      <Badge variant="destructive">was overdue</Badge>
                    ) : entry.conditionCode ? (
                      <Badge variant="outline">{entry.conditionCode.toLowerCase()}</Badge>
                    ) : undefined
                  }
                >
                  <RowTitle>{entry.holderLabel ?? entry.locationPath ?? "—"}</RowTitle>
                  <RowMeta>
                    {readableMoment(entry.issuedAt)}
                    {entry.returnedAt ? ` → ${readableMoment(entry.returnedAt)}` : " → still out"}
                    {entry.dueAt && !entry.returnedAt ? ` · due ${relativeTime(entry.dueAt)}` : ""}
                  </RowMeta>
                  {entry.note && <RowMeta>{entry.note}</RowMeta>}
                </Row>
              ))}
            </RowList>
          )}
        </RowGroup>
        </>
      )}
    </div>
  )
}

const TITLES: Record<Movement, string> = {
  issue: "Issue it",
  return: "Take it back",
  transfer: "Hand it on",
  "write-off": "Write it off",
}

function MovementForm({
  assetId,
  movement,
  onDone,
  onCancel,
}: {
  assetId: string
  movement: Movement
  onDone: () => void
  onCancel: () => void
}) {
  const { data: holders = [] } = useHolders()
  const { data: locations = [] } = useStorageLocations()
  const { data: conditions = [] } = useCustodyConditions()

  const issueAsset = useIssueAsset()
  const returnAsset = useReturnAsset()
  const transferAsset = useTransferAsset()
  const writeOffAsset = useWriteOffAsset()

  const [holderEntryId, setHolderEntryId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [conditionCode, setConditionCode] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [note, setNote] = useState("")

  const flatLocations = flatten(locations)

  const isPending =
    issueAsset.isPending || returnAsset.isPending || transferAsset.isPending || writeOffAsset.isPending

  const failed = (error: unknown) => {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

    toast.error(detail ?? "That movement was not recorded.")
  }

  const done = () => {
    toast.success("Recorded.")
    onDone()
  }

  function submit() {
    switch (movement) {
      case "issue":
        issueAsset.mutate(
          { assetId, holderEntryId, dueAt: dueAt || undefined, note: note.trim() || undefined },
          { onSuccess: done, onError: failed },
        )

        return

      case "return":
        returnAsset.mutate(
          {
            assetId,
            locationId,
            conditionCode: conditionCode || undefined,
            note: note.trim() || undefined,
          },
          { onSuccess: done, onError: failed },
        )

        return

      case "transfer":
        transferAsset.mutate(
          {
            assetId,
            holderEntryId: holderEntryId || undefined,
            locationId: locationId || undefined,
            dueAt: dueAt || undefined,
            note: note.trim() || undefined,
          },
          { onSuccess: done, onError: failed },
        )

        return

      case "write-off":
        writeOffAsset.mutate({ assetId, note: note.trim() }, { onSuccess: done, onError: failed })
    }
  }

  const wantsHolder = movement === "issue" || movement === "transfer"
  const wantsLocation = movement === "return" || movement === "transfer"
  const isReady =
    movement === "write-off"
      ? note.trim().length > 0
      : movement === "issue"
        ? holderEntryId !== ""
        : movement === "return"
          ? locationId !== ""
          : holderEntryId !== "" || locationId !== ""

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <span className="text-xs font-semibold tracking-[0.04em] uppercase">{TITLES[movement]}</span>

      {wantsHolder && (
        <EditorField
          label="To whom"
          hint={movement === "transfer" ? "Or leave blank and give a place instead." : undefined}
        >
          <PlainSelect value={holderEntryId} onChange={setHolderEntryId}>
            <option value="">— pick somebody —</option>
            {holders.map((holder) => (
              <option key={holder.entryId} value={holder.entryId}>
                {holder.label}
                {/* ⚠️ How much they already hold, on the option itself: handing a fifth overdue thing to
                    the same person is the mistake this list can prevent at the moment it is made. */}
                {holder.holding > 0 ? ` · has ${holder.holding}${holder.overdue > 0 ? `, ${holder.overdue} late` : ""}` : ""}
              </option>
            ))}
          </PlainSelect>
        </EditorField>
      )}

      {wantsLocation && (
        <EditorField label="To where" hint={movement === "transfer" ? "Or leave blank and give a person." : undefined}>
          <PlainSelect value={locationId} onChange={setLocationId}>
            <option value="">— pick a place —</option>
            {flatLocations.map(({ location, depth }) => (
              <option key={location.id} value={location.id}>
                {"— ".repeat(depth)}
                {location.name}
              </option>
            ))}
          </PlainSelect>
        </EditorField>
      )}

      {movement === "return" && conditions.length > 0 && (
        <EditorField
          label="Condition"
          hint={
            conditions.find((one) => one.code === conditionCode)?.triggersService
              ? "⚠️ Returning in this condition takes it out of circulation until somebody deals with it."
              : "How it came back."
          }
        >
          <PlainSelect value={conditionCode} onChange={setConditionCode}>
            <option value="">— as it went out —</option>
            {conditions.map((condition) => (
              <option key={condition.code} value={condition.code}>
                {condition.icon ? `${condition.icon} ` : ""}
                {condition.label}
              </option>
            ))}
          </PlainSelect>
        </EditorField>
      )}

      {(movement === "issue" || movement === "transfer") && (
        <EditorField label="Due back" hint="Optional. Without one it is never late.">
          <Input
            type="date"
            className="h-8 text-sm"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </EditorField>
      )}

      <EditorField
        label="Note"
        hint={movement === "write-off" ? "⚠️ Required — this is the one movement that must say why." : undefined}
      >
        <Textarea rows={2} className="text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
      </EditorField>

      <div className="flex gap-2">
        <Button size="sm" disabled={!isReady || isPending} onClick={submit}>
          Record it
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function flatten(nodes: StorageLocation[], depth = 0): Array<{ location: StorageLocation; depth: number }> {
  return nodes.flatMap((location) => [
    { location, depth },
    ...flatten(location.children ?? [], depth + 1),
  ])
}

/**
 * The same panel, as an overlay — for the places that are not a list with a column to spare.
 *
 * ⚠️ **This exists so the sheet is a DELIBERATE choice rather than the default.** A list screen opens
 * `AssetPanel` inside `DetailsPanel` and gets a column beside the rows; a station, the attention board
 * and a servicing queue open it over what they were showing, because none of them has a third column
 * and none of them is a list somebody scans while reading the panel. One body, two frames — never two
 * bodies drifting apart.
 */
export function AssetSheet({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const { data } = useAsset(assetId)
  const asset = data?.asset

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-sm">
            {asset?.label ?? "Asset"}
            {asset?.overdue && <Badge variant="destructive">overdue</Badge>}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {asset
              ? (asset.holderLabel ?? asset.locationPath ?? "nowhere in particular")
              : "Where it is, and who has had it."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AssetPanel assetId={assetId} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
