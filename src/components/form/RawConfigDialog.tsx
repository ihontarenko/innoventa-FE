import { useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  cn,
} from "@jmouse/ui"
import { BOUNDED_DIALOG, DialogBody } from "@/components/BoundedDialog"
import { CATALOGUED_CONFIG_KEYS } from "@/lib/formConfigCatalogue"
import { parseKeyValueLines, serializeKeyValueLines } from "@/lib/keyValueLines"

/**
 * The whole configuration as text, for when the controls are the long way round.
 *
 * ⚠️ **A dialog rather than a panel, because it is the escape hatch and not the road.** Every key that
 * has a control should be set with it — a picker cannot mistype a field name and a text box can. This is
 * for pasting a configuration between forms, for keys the catalogue has no control for, and for seeing
 * everything at once.
 *
 * ⚠️ **What is absent is deleted.** The text IS the configuration, not a patch onto it — so a line
 * removed here removes the key. Said on the dialog rather than only here, because that is the one thing
 * about this editor somebody can lose work to.
 *
 * ⚠️ **It edits a copy and applies on Save.** Parsing straight into the live map would let a half-typed
 * line blank a key while somebody is still typing the value.
 */
export function RawConfigDialog({
  config,
  onApply,
  onClose,
}: {
  config: Record<string, string>
  onApply: (next: Record<string, string>) => void
  onClose: () => void
}) {
  const [text, setText] = useState(() => serializeKeyValueLines(config))

  const parsed = parseKeyValueLines(text)
  const uncatalogued = Object.keys(parsed).filter((key) => !CATALOGUED_CONFIG_KEYS.has(key))

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(BOUNDED_DIALOG, "sm:max-w-2xl")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm">Raw configuration</DialogTitle>
          <DialogDescription className="text-xs">
            <code className="font-mono">key=value</code>, one per line — the same map the controls write.
            ⚠️ Anything missing from here is deleted on save.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <Textarea
            rows={16}
            className="font-mono text-xs"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          {uncatalogued.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {uncatalogued.length} key{uncatalogued.length === 1 ? "" : "s"} here {uncatalogued.length === 1 ? "has" : "have"}{" "}
              no control of its own:{" "}
              {/* ⚠️ break-all: these are snake_case keys with no spaces, so nothing else would wrap them. */}
              <span className="font-mono break-all">{uncatalogued.join(", ")}</span>
            </p>
          )}
        </DialogBody>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(parsed)
              onClose()
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

