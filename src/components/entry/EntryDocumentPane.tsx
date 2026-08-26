import { useState } from "react"
import { ChevronDown, Download, ExternalLink, FileText } from "lucide-react"
import { Button, cn } from "@jmouse/ui"
import { fileLinks, parseFileFieldValue } from "@/api/files"
import type { DatasheetCapability } from "@/components/entry/entryCapabilities"
import type { FormEntry } from "@/types"

/**
 * The record's document, on the record's own page.
 *
 * ⚠️ **Only ever drawn when there is something to draw.** A permanent viewer pane is the one thing that
 * makes a parts page feel like a distributor's, and also the one thing that leaves half a screen empty
 * on every row that has no datasheet — which, in a real workspace, is most of them. So the pane is a
 * consequence of a stored file, never a fixture; the *absence* of one is the rail's Documents panel,
 * where it reads as something to do rather than as a hole.
 *
 * ⚠️ **A stored FILE embeds, a URL does not.** `/_/file/{token}` is this installation's own address and
 * an iframe may show it; a distributor's PDF is a third-party origin that usually refuses to be framed,
 * and an embed that silently renders blank is worse than an honest link. So the URL case is a link, and
 * says so.
 */
export function EntryDocumentPane({
  entry,
  datasheet,
}: {
  entry: FormEntry
  datasheet: DatasheetCapability
}) {
  const [isOpen, setOpen] = useState(true)

  const stored = datasheet.file ? (entry.fieldValues[datasheet.file.name] ?? "") : ""
  const reference = parseFileFieldValue(stored)

  if (!reference) {
    return null
  }

  const address = fileLinks.view(reference.viewToken)

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <FileText className="size-4 shrink-0 text-muted-foreground" />

        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={reference.filename}>
          {reference.filename}
        </span>

        <Button asChild variant="ghost" size="xs">
          <a href={address} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            Open
          </a>
        </Button>

        <Button asChild variant="ghost" size="xs">
          <a href={address} download={reference.filename}>
            <Download className="size-3.5" />
            Download
          </a>
        </Button>

        {/* ⚠️ Collapsible, and it remembers nothing. A viewer that stays shut across records would hide
            the document on the next row somebody opens *to read the document* — the state belongs to
            this reading of this record, not to the person. */}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse the document" : "Show the document"}
          onClick={() => setOpen(!isOpen)}
        >
          <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90")} />
        </Button>
      </header>

      {isOpen && (
        /* ⚠️ A `title` is not decoration here — an untitled frame is announced as "frame" and nothing
           else, which is the whole of what a screen reader gets from this element. */
        <iframe
          src={address}
          title={reference.filename}
          className="h-[70svh] max-h-[760px] min-h-[380px] w-full border-0 bg-muted"
        />
      )}
    </section>
  )
}
