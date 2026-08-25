import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ScanLine } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@jmouse/ui"
import { AssetDrawer } from "@/components/custody/AssetDrawer"
import { RecordReadingForm } from "@/components/custody/AssetReadings"
import { ScanDialog } from "@/components/custody/ScanDialog"
import { useCustodyModule, useMonitoringModule, usePickableMetrics } from "@/hooks/useMonitoring"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import type { ScanResolution } from "@/api/custody"

/**
 * A code, from anywhere in the workspace.
 *
 * ⚠️ **The scan had no front door.** `ScanDialog` was reachable from one button on the asset board, which
 * is the screen somebody is on when they already have the list in front of them — precisely not the case
 * scanning is for. Somebody standing at a machine wants the number written down in ten seconds without
 * finding the thing first.
 *
 * ⚠️ **It resolves to a thing OR a place**, and a place is not a lesser answer — a code on a shelf is as
 * real as one on a drill. A place leads to the locations screen, which already lists what is in it.
 *
 * ⚠️ **Online only, deliberately.** An offline queue begins with conflicts, ordering and retries rather
 * than with a resolver, and none of those are decided here. A failed request stays failed.
 */
export function QuickScan() {
  const hasCustody = useCustodyModule()

  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<ScanResolution | null>(null)

  /**
   * ⚠️ **`Alt+S`, and not a bare letter.** The workspace is full of text inputs; a single-key shortcut
   * would fire while somebody was typing an inventory number into one of them. The modifier is what makes
   * it safe to bind globally, and the button says which combination it is rather than leaving it folklore.
   */
  useEffect(() => {
    if (!hasCustody) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "s") {
        event.preventDefault()
        setScanning(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hasCustody])

  if (!hasCustody) {
    return null
  }

  /*
    ⚠️ **It carries its own group, because it is the thing that decides whether it appears.**

    The sidebar used to wrap this in `SidebarGroup > SidebarGroupContent > SidebarMenu > SidebarMenuItem`
    and rely on the `null` above to leave nothing behind. It does not: returning `null` empties the
    chrome, it does not remove it. Every workspace without custody drew an empty group — 12px of its own
    padding with the column's `gap-2` on each side of it — which reads as a hole above the first heading
    and as nothing at all in the markup that produced it.

    So the rule is the one `PinnedViews` already follows: whatever decides *whether* something is in the
    menu returns the group too, and a caller never wraps a component that can decline.
  */
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setScanning(true)} title="Scan a code — Alt+S">
              <ScanLine className="size-4" />
              <span className="flex-1 text-left">Scan a code</span>
              <kbd className="rounded border px-1 text-[10px] text-muted-foreground">Alt+S</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      {scanning && (
        <ScanDialog
          onResolved={(resolution) => {
            setScanning(false)
            setFound(resolution)
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {found && <WhatNow resolution={found} onClose={() => setFound(null)} />}
    </SidebarGroup>
  )
}

/**
 * What can be done to the thing that was just found.
 *
 * ⚠️ **The dialog stops here rather than guessing.** Somebody scanning at a machine most often wants to
 * write a number down; somebody scanning at the store counter wants to hand it over. Choosing for them
 * would be right about half the time, and the wrong half costs a whole flow.
 */
function WhatNow({ resolution, onClose }: { resolution: ScanResolution; onClose: () => void }) {
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((store) => store.activeSpaceSlug)

  const watchesEquipment = useMonitoringModule()

  const isAsset = resolution.kind === "asset" && Boolean(resolution.subjectId)
  const assetId = resolution.subjectId ?? ""

  const [mode, setMode] = useState<"choose" | "reading" | "open">("choose")

  // ⚠️ Asked only of a thing that is watched, and only once the dialog is showing an asset — a metric
  // list for a place is a request that answers 403 and a shelf that appears to have motorhours.
  const { data: metrics = [] } = usePickableMetrics(
    isAsset && watchesEquipment ? assetId : undefined,
  )

  if (mode === "open" && isAsset) {
    return <AssetDrawer assetId={assetId} onClose={onClose} />
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resolution.label || "Found it"}</DialogTitle>
          <DialogDescription>
            {resolution.kind === "location"
              ? "A place. Everything kept in it is on the locations screen."
              : "What would you like to do with it?"}
          </DialogDescription>
        </DialogHeader>

        {resolution.kind === "location" && (
          <Button
            type="button"
            onClick={() => {
              onClose()

              if (spaceSlug) {
                navigate(spaceSectionPath(spaceSlug, "locations"))
              }
            }}
          >
            Open the place
          </Button>
        )}

        {isAsset && mode === "choose" && (
          <div className="flex flex-col gap-2">
            {metrics.length > 0 && (
              <Button type="button" onClick={() => setMode("reading")}>
                Write down a reading
              </Button>
            )}

            <Button type="button" variant="outline" onClick={() => setMode("open")}>
              Open it — hand over, take back, service, check
            </Button>

            {watchesEquipment && metrics.length === 0 && (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Nothing is measured about these things yet — the <strong>Watch</strong> screen is where
                that is set up.
              </p>
            )}
          </div>
        )}

        {/* ⚠️ The asset drawer's own form, mounted here. A second reading form would be a second place
            for the falling-counter warning to be handled, and that warning is the point of the form. */}
        {isAsset && mode === "reading" && <RecordReadingForm assetId={assetId} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
