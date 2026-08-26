import { useEffect, useState } from "react"
import { Download, ExternalLink, Plus } from "lucide-react"
import { Badge, Button, Skeleton, cn } from "@jmouse/ui"
import { fileLinks, parseFileFieldValue } from "@/api/files"
import { CadAttachmentsPanel } from "@/components/cad/CadAttachmentsPanel"
import { CadEntriesGrid } from "@/components/cad/CadEntriesGrid"
import { FieldValue } from "@/components/form/FieldValue"
import { useEntriesByPurpose } from "@/hooks/useWorkspaceForms"
import type { FormEntry } from "@/types"

const CAD_FILE_PURPOSE = "CAD_FILE"

const KIND_LABELS: Record<string, string> = {
  SYMBOL: "Symbol",
  FOOTPRINT: "Footprint",
  MODEL_3D: "3D body",
}

const FORMAT_LABELS: Record<string, string> = {
  KICAD_SYM: "KiCad symbol",
  KICAD_MOD: "KiCad footprint",
  STEP: "STEP",
  WRL: "VRML",
  GLB: "glTF",
  OTHER: "Other",
}

/**
 * The CAD catalogue as a workbench: the drawings on one side, everything about the selected one on the
 * other.
 *
 * ⚠️ **A drawing and its files are two records and one thing.** Making somebody navigate between two
 * screens to see one thing hands them the model to hold in their head — which is the thing the interface
 * is supposed to do for them.
 *
 * ⚠️ **Stacked below `lg`, side by side above it — decided, not left to the browser.** Two panes squeezed
 * into a phone is one unreadable pane and a horizontal scrollbar. Below the breakpoint the detail simply
 * sits under the list, which is a layout somebody can actually use rather than a wide one made narrow.
 *
 * ⚠️ **This is a presentation of the Catalogs screen, not a route of its own.** One menu entry covers
 * both catalogues; a second would be the thing that decision exists to prevent.
 */
export function CadWorkbench({
  entries,
  onOpen,
  onAddFile,
}: {
  entries: FormEntry[]
  /** Open the full record — the drawer, with everything the detail pane summarises. */
  onOpen: (entry: FormEntry) => void
  /** Start a new file against this drawing, with the drawing already chosen. */
  onAddFile: (drawing: FormEntry) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ⚠️ A selection that survives its own row is a detail pane about something no longer on screen —
  // filtering, paging or switching type all do it.
  useEffect(() => {
    if (selectedId && !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null)
    }
  }, [entries, selectedId])

  const selected = entries.find((entry) => entry.id === selectedId) ?? null

  return (
    <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 border-b lg:border-r lg:border-b-0">
        <CadEntriesGrid
          entries={entries}
          selectedId={selectedId}
          onOpen={(entry) => setSelectedId(entry.id)}
        />
      </div>

      <div className="min-w-0 p-4">
        {selected ? (
          <DrawingDetail
            drawing={selected}
            onOpen={() => onOpen(selected)}
            onAddFile={() => onAddFile(selected)}
          />
        ) : (
          /*
            ⚠️ An empty pane says what filling it takes. A blank half-screen reads as something that
            failed to load, and this one is empty on arrival every single time.
          */
          <p className="rounded border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
            Pick a drawing to see its files and what uses it.
          </p>
        )}
      </div>
    </div>
  )
}

function DrawingDetail({
  drawing,
  onOpen,
  onAddFile,
}: {
  drawing: FormEntry
  onOpen: () => void
  onAddFile: () => void
}) {
  const identifier = drawing.fieldValues?.cad_identifier ?? ""
  const kind = drawing.fieldValues?.cad_kind
  const library = drawing.fieldValues?.cad_library
  const preview = drawing.fieldValues?.cad_preview

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        {preview && (
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40 p-1">
            <FieldValue value={preview} elementType="IMAGE" imageClassName="size-full object-contain" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <code className="break-all font-mono text-xs">{identifier || "‹no identifier›"}</code>
          <div className="flex flex-wrap items-center gap-1.5">
            {kind && (
              <Badge variant="secondary" className="text-[10px]">
                {KIND_LABELS[kind] ?? kind}
              </Badge>
            )}
            {library && <span className="text-[11px] text-muted-foreground">{library}</span>}
          </div>
        </div>

        <Button size="sm" variant="outline" className="shrink-0" onClick={onOpen}>
          Open
          <ExternalLink className="ml-1 size-3.5" />
        </Button>
      </header>

      <DrawingFiles drawing={drawing} onAddFile={onAddFile} />

      {/*
        ⚠️ Both ends, as everywhere: what this drawing uses, and what uses it. The count is what tells
        somebody whether changing this is safe.
      */}
      <CadAttachmentsPanel entryId={drawing.id} drawingKind={kind ?? null} entryTitle={identifier} />
    </div>
  )
}

/**
 * The files of one drawing.
 *
 * ⚠️ **Narrowed on the server by the drawing's id, then confirmed here.** The purpose-wide endpoint
 * matches a search term against any stored value, and the value `cad_drawing` holds *is* the drawing's
 * id — so asking for it narrows the query to very nearly the right rows. Very nearly: a note that happens
 * to quote the id would match too, which is why the exact check is repeated in the browser rather than
 * trusted from the search.
 */
function DrawingFiles({ drawing, onAddFile }: { drawing: FormEntry; onAddFile: () => void }) {
  const { data: page, isLoading } = useEntriesByPurpose(CAD_FILE_PURPOSE, 0, 200, {
    query: drawing.id,
  })

  const files = (page?.content ?? []).filter(
    (entry) => entry.fieldValues?.cad_drawing === drawing.id,
  )

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">
            Files
            {files.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {files.length}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">The bytes this drawing is made of.</p>
        </div>

        <Button size="sm" variant="outline" onClick={onAddFile}>
          <Plus className="mr-1 size-3.5" />
          Add a file
        </Button>
      </header>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : files.length === 0 ? (
        /*
          ⚠️ **No files is the NORMAL case and must not read as missing.** A standard footprint is a name
          the tool resolves against its own libraries; bytes are for the drawings nobody else has.
        */
        <p className="rounded border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          No files — this drawing is a name a CAD tool resolves against its own libraries. Add one only
          when somebody has to be handed the bytes.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {files.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </ul>
      )}
    </section>
  )
}

function FileRow({ file }: { file: FormEntry }) {
  const stored = file.fieldValues?.cad_file ?? ""
  const reference = parseFileFieldValue(stored)
  const format = file.fieldValues?.cad_file_format
  const notes = file.fieldValues?.cad_file_notes

  return (
    <li className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-xs">{reference?.filename ?? stored}</span>
        {notes && <span className="truncate text-[11px] text-muted-foreground">{notes}</span>}
      </div>

      {format && (
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {FORMAT_LABELS[format] ?? format}
        </Badge>
      )}

      {/*
        ⚠️ A reference with no view token is not a link — it is what a field holds before an upload
        finished. Drawn as plain text rather than as a control that leads nowhere.
      */}
      {reference && (
        <a
          href={fileLinks.view(reference.viewToken)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground",
            "hover:bg-accent hover:text-foreground",
          )}
        >
          <Download className="size-3.5" />
          Download
        </a>
      )}
    </li>
  )
}
