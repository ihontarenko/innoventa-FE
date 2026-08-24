import { useEffect, useState } from "react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  cn,
} from "@jmouse/ui"
import { BOUNDED_DIALOG, DialogBody } from "@/components/BoundedDialog"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import { fileOwner, filesApi } from "@/api/files"
import { labelTemplatesApi, labelsApi } from "@/api/labels"
import { authApi } from "@/api/auth"
import { useLabelTemplatesForForm } from "@/hooks/useLabels"
import { problemDetailOf } from "@/lib/apiErrors"
import { DEFAULT_SHEET, sheetGridFor, type LabelPaperMode, type SheetSettings } from "@/lib/labels/labelPaper"
import {
  LABEL_RUN_CEILING,
  LABEL_RUN_PROBE,
  downloadBlob,
  labelCountOf,
  labelFileName,
  labelPng,
  pageCountOf,
  printRun,
  type PrintRun,
} from "@/lib/labels/labelPrinting"
import type { LabelTemplateDetail, LabelTemplateSummary, ResolvedLabelRecord } from "@/types"

/**
 * PNG and Files export one file per label, and past this it stops being an export.
 *
 * ⚠️ Stated rather than silently truncated: a dialog that quietly exported the first twenty-five of a
 * hundred would be a dialog that lost seventy-five labels somebody believed they had.
 */
const MAXIMUM_EXPORTED_FILES = 25

/**
 * Choosing the paper, and the three ways a label leaves the product.
 *
 * ⚠️ **The design owns the label's size; this owns the page.** The same 12×40 design goes to a roll one
 * label per page, or is tiled onto an A4 sheet with a start offset — and neither is stored on the
 * design, because a design is not about paper.
 *
 * ⚠️ **Batch is by FILTER, not by selection.** Whoever opens this has already turned "forty laptops
 * arrived" into a list of ids using their own screen's filter; this dialog says how many that is
 * *before* anything happens, and refuses a run past the ceiling in words rather than hanging the
 * browser laying it out.
 */
export function LabelPrintDialog({
  formId,
  ids,
  subject,
  onClose,
}: {
  /**
   * ⚠️ **The only thing that decides which designs are offered.** A design lays out one form's fields,
   * so a design for another form is not offered rather than offered and printed empty — an empty
   * rectangle prints silently and is noticed on a glued box.
   */
  formId: string
  ids: string[]
  /** What the caller is printing, in words: "3 things", "the whole filter". */
  subject: string
  onClose: () => void
}) {
  const { data: offered = [], isLoading } = useLabelTemplatesForForm(formId)

  const [templateId, setTemplateId] = useState<string | null>(null)
  const [mode, setMode] = useState<LabelPaperMode>("ROLL")
  const [sheet, setSheet] = useState<SheetSettings>(DEFAULT_SHEET)
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!templateId && offered.length > 0) {
      setTemplateId(offered[0].id)
    }
  }, [offered, templateId])

  const chosen = offered.find((template) => template.id === templateId) ?? null

  // ⚠️ Counting needs the size and the records, not the design — so the run counted here is the real
  // shape rather than a template faked up with a cast.
  const countedRun: PrintRun | null = chosen && {
    template: { widthMm: chosen.widthMm, heightMm: chosen.heightMm },
    records: ids.map((id) => ({ id, elements: {}, codes: {}, failures: {} })),
    mode,
    sheet,
    copies,
  }

  const labelCount = countedRun ? labelCountOf(countedRun) : ids.length
  const pageCount = countedRun ? pageCountOf(countedRun) : 0

  /**
   * ⚠️ Counted in **labels**, not in records. Five hundred records at fifty copies each is twenty-five
   * thousand pages, and a ceiling that only looked at the record count would wave that through — the
   * browser hang, arrived at by the other door.
   */
  const tooMany = labelCount > LABEL_RUN_CEILING

  /** Resolve the whole run in one call, then hand the result to whichever output was asked for. */
  async function withResolvedRun(
    action: (template: LabelTemplateDetail, records: ResolvedLabelRecord[]) => Promise<void> | void,
    busyLabel: string,
  ) {
    if (!chosen) {
      return
    }

    setBusy(busyLabel)
    setProblem(null)
    setNote(null)

    try {
      const [detail, resolved] = await Promise.all([
        labelTemplatesApi.detail(chosen.id).then((response) => response.data),
        labelsApi.resolve(chosen.id, ids).then((response) => response.data),
      ])

      await action(detail, resolved)
    } catch (failure) {
      setProblem(readableProblem(failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(BOUNDED_DIALOG, "sm:max-w-md")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">Print labels</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {subject} — <strong>{labelCount || ids.length}</strong> {labelCount === 1 ? "label" : "labels"}
                {chosen && `, ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
              </p>

              {tooMany && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  That is {labelCount} labels
                  {copies > 1 && ` (${ids.length} records × ${copies} copies)`}, and {LABEL_RUN_CEILING} is as
                  many as one press of print can produce.
                  {ids.length >= LABEL_RUN_PROBE
                    ? " The filter matches more than that — narrow it and print in batches."
                    : " Fewer copies, or a narrower filter."}{" "}
                  A browser laying out that many pages stops responding rather than finishing slowly.
                </p>
              )}

              {offered.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Nothing here has a design for this form yet — neither yours nor anything shared into this
                  workspace. Labels is where one is drawn.
                </p>
              ) : (
                <>
                  <EditorField label="Design">
                    <PlainSelect value={templateId ?? ""} onChange={setTemplateId}>
                      {offered.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} — {template.widthMm}×{template.heightMm} mm
                          {template.mine ? "" : " · shared"}
                        </option>
                      ))}
                    </PlainSelect>
                  </EditorField>

                  <div className="grid grid-cols-2 gap-2">
                    <EditorField label="Paper">
                      <PlainSelect value={mode} onChange={(value) => setMode(value as LabelPaperMode)}>
                        <option value="ROLL">Roll — one label per page</option>
                        <option value="SHEET">A4 sheet — tiled</option>
                      </PlainSelect>
                    </EditorField>

                    <EditorField label="Copies of each">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={copies}
                        onChange={(event) => setCopies(Math.max(1, Number(event.target.value)))}
                      />
                    </EditorField>
                  </div>

                  {mode === "SHEET" && chosen && (
                    <SheetControls template={chosen} settings={sheet} onChange={setSheet} />
                  )}
                </>
              )}

              {problem && <p className="text-xs text-destructive">{problem}</p>}
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </div>
          )}

          {/* ⚠️ Four actions rather than the usual two: print, PNG and Files are three different ways out
              of the same run, and none of them is the "cancel or save" a footer is shaped for. */}
        </DialogBody>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="ghost"
            disabled={!chosen || tooMany || !!busy}
            onClick={() =>
              void withResolvedRun(async (template, records) => {
                const saved = records.slice(0, MAXIMUM_EXPORTED_FILES)
                const cabinet = await authApi.getProfile().then((response) => response.data.filesRootId)

                for (const record of saved) {
                  const name = labelFileName(template, record)
                  const blob = await labelPng(template, record)

                  await filesApi.upload(fileOwner.directory(cabinet), new File([blob], name, { type: "image/png" }))
                }

                setNote(
                  records.length > saved.length
                    ? `${saved.length} of ${records.length} saved into Files — past ${MAXIMUM_EXPORTED_FILES} files this is a print, not an export.`
                    : `${saved.length} saved into Files.`,
                )
              }, "Saving…")
            }
          >
            Save into Files
          </Button>
          <Button
            variant="ghost"
            disabled={!chosen || tooMany || !!busy}
            onClick={() =>
              void withResolvedRun(async (template, records) => {
                const exported = records.slice(0, MAXIMUM_EXPORTED_FILES)

                for (const record of exported) {
                  downloadBlob(await labelPng(template, record), labelFileName(template, record))
                }

                if (records.length > exported.length) {
                  setNote(
                    `${exported.length} of ${records.length} exported — past ${MAXIMUM_EXPORTED_FILES} files this is a print, not an export.`,
                  )
                }
              }, "Exporting…")
            }
          >
            PNG
          </Button>
          <Button
            disabled={!chosen || tooMany || !!busy}
            onClick={() =>
              void withResolvedRun((template, records) => {
                printRun({ template, records, mode, sheet, copies })
              }, "Printing…")
            }
          >
            {busy ?? "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The sheet's own geometry, and the offset that makes a half-used sheet usable.
 *
 * ⚠️ Without *skip the first N cells* every print needs a fresh sheet, and people print onto crookedly
 * reinserted ones instead.
 */
function SheetControls({
  template,
  settings,
  onChange,
}: {
  template: LabelTemplateSummary
  settings: SheetSettings
  onChange: (settings: SheetSettings) => void
}) {
  const grid = sheetGridFor(template.widthMm, template.heightMm, settings)

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <EditorField label="Margin, mm">
          <Input
            type="number"
            min={0}
            step={1}
            value={settings.marginMm}
            onChange={(event) => onChange({ ...settings, marginMm: Math.max(0, Number(event.target.value)) })}
          />
        </EditorField>
        <EditorField label="Gap, mm">
          <Input
            type="number"
            min={0}
            step={0.5}
            value={settings.gapMm}
            onChange={(event) => onChange({ ...settings, gapMm: Math.max(0, Number(event.target.value)) })}
          />
        </EditorField>
        <EditorField label="Skip cells">
          <Input
            type="number"
            min={0}
            step={1}
            value={settings.startOffset}
            onChange={(event) =>
              onChange({ ...settings, startOffset: Math.max(0, Math.floor(Number(event.target.value))) })
            }
          />
        </EditorField>
      </div>

      <p className="text-xs text-muted-foreground">
        {grid.columns}×{grid.rows} — {grid.perSheet} labels a sheet.
        {settings.startOffset > 0 &&
          ` The first ${settings.startOffset} ${settings.startOffset === 1 ? "cell is" : "cells are"} left untouched.`}
      </p>
    </>
  )
}

/**
 * What went wrong, in the words of whoever refused.
 *
 * ⚠️ **A 402 is called what it is.** Saving into Files writes bytes, and `storage-byte` is a metered
 * quota — so an organisation out of storage gets a refusal about storage, not "the labels could not be
 * printed". They printed fine; there was nowhere to put the copy.
 */
function readableProblem(failure: unknown): string {
  const status = (failure as { response?: { status?: number } })?.response?.status
  const { title, detail } = problemDetailOf(failure)

  if (status === 402) {
    return (
      detail ??
      "This workspace is out of storage, so the label could not be filed. It still prints and still exports."
    )
  }

  return detail ?? title
}
