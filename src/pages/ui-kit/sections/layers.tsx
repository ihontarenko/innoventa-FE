import { useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@jmouse/ui"
import type { KitSection } from "../Specimen"

/** Everything that opens over the page, and which of them each situation earns. */

function DialogSpecimen() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open a dialog
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Role · SPACE_ADMIN</DialogTitle>
          <DialogDescription>Nothing here is in force until the document is rehearsed and saved.</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          ⚠️ Width takes the <span className="font-mono">sm:</span> prefix —{" "}
          <span className="font-mono">sm:max-w-lg</span> is pinned by the primitive, and an unprefixed{" "}
          <span className="font-mono">max-w-4xl</span> silently loses to it.
        </p>
        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" size="sm" className="text-destructive">
            Remove
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SheetSpecimen() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          Open a drawer
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Event</SheetTitle>
          <SheetDescription>Everything this one operation touched, knew and came from.</SheetDescription>
        </SheetHeader>
        <div className="p-4 text-xs text-muted-foreground">
          A drawer rather than a page, so the list and the filters stay on screen — somebody working through
          twenty rows one by one should never lose their place.
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const layersSection: KitSection = {
  key: "layers",
  label: "Шари",
  about: "What opens over the page — and the question each one answers about where the reader should end up.",
  specimens: [
    {
      name: "dialog",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Dialog",
      what: "One thing, opened to be edited and applied. The page behind it is where you return.",
      note: (
        <>
          ⚠️ <strong>Width needs `sm:`</strong> — `DialogContent` pins `sm:max-w-lg`, and an unprefixed `max-w-*`
          does not conflict with it. The symptom is silent: everything renders at `lg`.
        </>
      ),
      render: () => <DialogSpecimen />,
    },
    {
      name: "drawer",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Sheet",
      what: "The detail of one row, with the list still on screen. For reading, not for a form.",
      render: () => <SheetSpecimen />,
    },
    {
      name: "popover",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Popover",
      what: "A small surface anchored to what opened it — a picker, a filter, a colour.",
      note: "⚠️ Not for anything with its own Save. That is a dialog.",
      render: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Open a popover
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 text-xs">Anchored to the trigger, and it moves with it.</PopoverContent>
        </Popover>
      ),
    },
    {
      name: "menu",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "DropdownMenu",
      what: "A short list of things to do, opened from one control.",
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Open a menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>This account</DropdownMenuLabel>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Reset password</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      name: "hint",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Tooltip",
      what: "The word a glyph could not carry. Never the only place something is said.",
      note: "⚠️ Nothing that matters lives only in a tooltip — it is unreachable on a touch screen.",
      render: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Example">
                ⌨
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit as .jmp</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      name: "disclosure",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Collapsible",
      what: "A detail folded away until it is asked for — in the flow of the page, not over it.",
      render: () => (
        <Collapsible className="w-full">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              ▸ What it holds
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 py-2 text-xs text-muted-foreground">
            Permissions, places and roles — all opaque strings across the port.
          </CollapsibleContent>
        </Collapsible>
      ),
    },
    {
      name: "scroll",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "ScrollArea",
      what: "A bounded region that scrolls inside a page that also scrolls.",
      note: (
        <>
          ⚠️ <strong>`max-h-*` goes on the viewport, not the root.</strong> On the root it clips silently instead of
          scrolling — the content is simply gone.
        </>
      ),
      render: () => (
        <ScrollArea className="h-24 w-full rounded-md border">
          <div className="flex flex-col gap-1 p-2 text-xs">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index}>row {index + 1}</span>
            ))}
          </div>
        </ScrollArea>
      ),
    },
    {
      name: "toast",
      origin: "vendor",
      from: "sonner",
      symbol: "toast",
      what: "What happened, after it happened. For an outcome nobody has to act on.",
      note: (
        <>
          ⚠️ <strong>Never for a refusal somebody must read</strong> — that belongs on the screen, where it stays.
          <br />
          The `toast` call is sonner's own; the `{"<Toaster />"}` that draws
          them is the library's, mounted once in `Application.tsx`.
        </>
      ),
      render: () => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Trial started.")}>
            success
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.error("Could not save the link.")}>
            error
          </Button>
        </div>
      ),
    },
  ],
}
