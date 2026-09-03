import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  Textarea,
} from "@jmouse/ui"
import { ToggleChip } from "@/components/ToggleChip"
import { stocktakesApi, type CreateStocktakeRequest, type Stocktake } from "@/api/stocktakes"
import { useCreateStocktake } from "@/hooks/useStocktakes"
import { useHolders } from "@/hooks/useCustody"
import { capitalised, useTerm } from "@/hooks/useTerminology"
import { useStorageLocations } from "@/hooks/useStorageLocations"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"

type Scope = "location" | "type"

/**
 * Drawing a sheet.
 *
 * ⚠️ **The scope is one of two, and the dialog says so with a switch rather than by validating.** A
 * place and a type are two different walks; offering both fields at once and refusing the combination
 * afterwards would be a form that lets somebody fill in a mistake first.
 *
 * ⚠️ **The preview is the whole point of the dialog.** *This will collect 12 positions* is the sentence
 * that stops somebody drawing an empty sheet or a five-hundred-row one, and it is asked as the scope
 * changes rather than on a button — a number you have to request is a number nobody requests.
 */
export function NewStocktakeDialog({
  open,
  onOpenChange,
  onCreated,
  initialLocationId,
  initialEntryIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (sheet: Stocktake) => void
  /** Pre-chosen when the dialog is opened from a place. */
  initialLocationId?: string
  /** Pre-chosen when it is opened from rows selected on the inventory screen. */
  initialEntryIds?: string[]
}) {
  const [scope, setScope] = useState<Scope>("location")
  const [locationId, setLocationId] = useState(initialLocationId ?? "")
  const [catalogFormId, setCatalogFormId] = useState("")
  const [includeNested, setIncludeNested] = useState(true)
  const [responsibleHolderId, setResponsibleHolderId] = useState("")
  const [note, setNote] = useState("")
  const [preview, setPreview] = useState<{ positions: number; scopeLabel: string } | null>(null)
  const [previewFailed, setPreviewFailed] = useState<string | null>(null)

  const { data: locations = [] } = useStorageLocations()
  const { data: types = [] } = useWorkspaceForms("CATALOG", { enabled: open })
  const { data: holders = [] } = useHolders()
  const term = useTerm()
  const create = useCreateStocktake()

  const chosen: CreateStocktakeRequest = {
    locationId: scope === "location" ? locationId || null : null,
    catalogFormId: scope === "type" ? catalogFormId || null : null,
    includeNested,
    responsibleHolderId: responsibleHolderId || null,
    note: note || null,
    entryIds: initialEntryIds ?? [],
  }

  const ready = scope === "location" ? Boolean(locationId) : Boolean(catalogFormId)

  /**
   * ⚠️ **Asked on every change of scope, and the failure is shown rather than swallowed.** A preview
   * that silently answered nothing would look exactly like a scope holding nothing — and one of those
   * is a reason to pick something else, while the other is a reason to call somebody.
   */
  useEffect(() => {
    if (!open || !ready) {
      setPreview(null)
      setPreviewFailed(null)
      return
    }

    let current = true

    stocktakesApi
      .preview(chosen)
      .then((response) => {
        if (current) {
          setPreview(response.data)
          setPreviewFailed(null)
        }
      })
      .catch((failure) => {
        if (current) {
          setPreview(null)
          setPreviewFailed(failure?.response?.data?.detail ?? "This scope could not be checked.")
        }
      })

    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, locationId, catalogFormId, includeNested])

  function submit() {
    create.mutate(chosen, {
      onSuccess: (sheet) => {
        onOpenChange(false)
        onCreated(sheet)
      },
      onError: (failure: unknown) => {
        const problem = failure as { response?: { data?: { detail?: string } } }
        toast.error(problem.response?.data?.detail ?? "The sheet could not be drawn.")
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New stocktake</DialogTitle>
          <DialogDescription>
            A sheet freezes what the system believes right now. Count it, and the differences become
            movements.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">What is being counted</span>
            <div className="flex gap-1.5">
              <ToggleChip active={scope === "location"} onClick={() => setScope("location")}>
                A place
              </ToggleChip>
              <ToggleChip active={scope === "type"} onClick={() => setScope("type")}>
                A type of part
              </ToggleChip>
            </div>
          </div>

          {scope === "location" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" htmlFor="stocktake-place">
                Place
              </label>
              <NativeSelect
                id="stocktake-place"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">— pick a place</option>
                {locations.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.path || place.name}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={includeNested}
                  onChange={(event) => setIncludeNested(event.target.checked)}
                />
                Include everything inside it
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" htmlFor="stocktake-type">
                Type of part
              </label>
              <NativeSelect
                id="stocktake-type"
                value={catalogFormId}
                onChange={(event) => setCatalogFormId(event.target.value)}
              >
                <option value="">— pick a type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          {/* ⚠️ **The people already in the workspace, not its accounts.** Whoever walks the shelves is
              an entry on a HOLDER form — an employee, a crew, a contractor — and need never have logged
              in. Whoever types a count necessarily has an account, and that is recorded separately on
              each row; these are two different people and two different fields.

              ⚠️ And the WORD is the workspace's own: `term('holder.one')` is what this installation
              calls them, so a store that says "staff" is not told "holders" by a screen. */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor="stocktake-responsible">
              {capitalised(term("holder.one", "person"))} responsible
            </label>
            <NativeSelect
              id="stocktake-responsible"
              value={responsibleHolderId}
              onChange={(event) => setResponsibleHolderId(event.target.value)}
            >
              <option value="">— nobody yet</option>
              {holders.map((holder) => (
                <option key={holder.entryId} value={holder.entryId}>
                  {holder.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor="stocktake-note">
              Note
            </label>
            <Textarea
              id="stocktake-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Anything the sheet should carry — why it is being counted."
            />
          </div>

          {initialEntryIds && initialEntryIds.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Narrowed to {initialEntryIds.length} position(s) you selected, inside the scope above.
            </p>
          )}

          <div className="bg-muted/40 rounded-md p-2 text-xs">
            {!ready ? (
              <span className="text-muted-foreground">Pick a scope to see what it collects.</span>
            ) : previewFailed ? (
              <span className="text-destructive">{previewFailed}</span>
            ) : preview ? (
              <span className={preview.positions === 0 ? "text-destructive" : "text-muted-foreground"}>
                {preview.positions === 0
                  ? `Nothing is held in ${preview.scopeLabel} — there would be nothing to count.`
                  : `${preview.positions} position(s) in ${preview.scopeLabel} will go on the sheet.`}
              </span>
            ) : (
              <span className="text-muted-foreground">Checking what this collects…</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!ready || create.isPending || preview?.positions === 0}
          >
            {create.isPending ? "Drawing…" : "Draw the sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
