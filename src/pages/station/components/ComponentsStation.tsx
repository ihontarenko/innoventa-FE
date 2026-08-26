import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Camera, Check, Minus, Pencil, Plus, ScanLine, Search, X } from "lucide-react"
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
  useCodeScanner,
} from "@jmouse/ui"
import { entriesApi, formsApi } from "@/api/forms"
import { stationsApi } from "@/api/stations"
import { spaceSettingsApi } from "@/api/spaces"
import { craftsApi } from "@/api/crafts"
import { useReachableContext } from "@/hooks/useSpaces"
import { useSpaceStore } from "@/stores/spaceStore"
import { useOfflineQueue } from "@/lib/offline/useOfflineQueue"
import { LARGEST_QUEUED_PHOTOGRAPH } from "@/lib/offline/queue"
import type { FieldDetail, FormEntry } from "@/types/forms"
import { StationChrome } from "@/pages/station/StationChrome"
import { SetAsideList } from "@/pages/station/components/SetAsideList"
import { AddComponent } from "@/pages/station/components/AddComponent"
import { EditComponent } from "@/pages/station/components/EditComponent"
import { applyDelta, imageFieldOf, primaryFieldOf, rememberCountField, resolveCountField } from "./countField"

const INVENTORY = "INVENTORY"

/**
 * The Components station — find a component, adjust what is in stock, add one, photograph it.
 *
 * <h2>⚠️ This is a station, not Innoventa on a small screen</h2>
 *
 * <p>No form builder, no administration, no settings. Every request to add "just one more screen" is a
 * request for a different station, and the honest answer is a new tile — an administrator's station
 * would be the whole desktop shrunk onto a phone, which is what the idea exists to avoid.
 *
 * <h2>⚠️ Laid out for a thumb, not for a cursor</h2>
 *
 * <p>Everything that is tapped is at least 44px and the two controls used most — search and adding —
 * are within reach of a thumb rather than at the top of the screen. The pickers are one compact row
 * because they are set once a visit; the search is sticky because it is used all of it.
 *
 * <h2>⚠️ A component is an ENTRY of a form, and the form says what its fields mean</h2>
 *
 * <p>There is no component table. A <em>component type</em> is a form carrying the {@code INVENTORY}
 * purpose, and a component is one of its entries — so which field holds the count is the form's to
 * declare, through the same {@code config} that names its title and its picture.
 */
export function ComponentsStation() {
  const rememberedSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const [chosenSpaceId, setChosenSpaceId] = useState<string | null>(null)
  const [formId, setFormId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [scanning, setScanning] = useState(false)
  const [adding, setAdding] = useState(false)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)

  /**
   * ⚠️ **The station finds its own workspace, and never writes it into the space store.**
   *
   * <p>Its address is platform context — it names no workspace — and `NavigationContextGate` owns that
   * fact, calling `leaveSpace()` on any such address. A version of this screen that published its
   * resolved workspace fought the gate to a standstill: set, cleared, set, cleared, until React gave up
   * with *"Maximum update depth exceeded"* and a blank page. So the store stays the address's answer
   * and this stays the station's, carried by hand into every request below.
   */
  const offered = useQuery({
    queryKey: ["stations", "offered"],
    queryFn: () => stationsApi.offered().then((response) => response.data),
  })

  const worksIn = useMemo(
    () =>
      (offered.data?.stations.find((station) => station.key === "components")?.availableIn ?? []).filter(
        (space) => space.standing === "PERMITTED",
      ),
    [offered.data],
  )

  const spaceId =
    chosenSpaceId
    ?? (worksIn.some((space) => space.id === rememberedSpaceId) ? rememberedSpaceId : null)
    ?? worksIn[0]?.id
    ?? null

  /**
   * ⚠️ **The craft is read here so it can DO something, not to gate anything.**
   *
   * <p>A craft names what somebody opens first. Until the station read one it ordered a shelf with a
   * single tile on it, which is to say it did nothing at all — the concept was defined, administered
   * and inert. Here it picks which component type this person lands on, which is the thing a комірник
   * and an engineer genuinely differ about.
   *
   * <p>⚠️ Holding no craft is ORDINARY: the first component type wins, exactly as before. Nothing is
   * hidden and nothing is added — the craft only reorders a list this account was already permitted.
   */
  const context = useReachableContext()
  const organizationId =
    context.data?.organizations.find((organization) => organization.spaceIds.includes(spaceId ?? ""))?.id ?? null

  const myCraft = useQuery({
    queryKey: ["crafts", organizationId, "mine"],
    queryFn: () => craftsApi.mine(organizationId!).then((response) => response.data.craft ?? null),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
  })

  const componentTypes = useQuery({
    queryKey: ["spaces", spaceId, "forms", INVENTORY],
    queryFn: () => spaceSettingsApi.formsPaged(spaceId!, 0, 500, INVENTORY).then((response) => response.data.content),
    enabled: Boolean(spaceId),
  })
  // ⚠️ The craft is consulted AFTER the list exists, and can only pick from it. A key naming a type
  // this workspace does not have simply matches nothing — which is the failure mode the whole shape was
  // built to have.
  const craftPrefers = (myCraft.data?.preferredKeys ?? []).find((key) =>
    (componentTypes.data ?? []).some((type) => type.id === key),
  )

  const chosenFormId = formId ?? craftPrefers ?? componentTypes.data?.[0]?.id ?? null

  const form = useQuery({
    queryKey: ["forms", chosenFormId, "detail"],
    queryFn: () => formsApi.get(chosenFormId!).then((response) => response.data),
    enabled: Boolean(chosenFormId),
  })

  const entries = useQuery({
    queryKey: ["station", "components", chosenFormId, spaceId, query],
    queryFn: () =>
      entriesApi
        .list(chosenFormId!, 0, 50, spaceId ?? undefined, query || undefined)
        .then((response) => response.data.content),
    enabled: Boolean(chosenFormId && spaceId),
  })

  const queue = useOfflineQueue()

  const fields = form.data?.fields ?? []
  const config = form.data?.config ?? {}
  const count = useMemo(
    () => (chosenFormId ? resolveCountField(chosenFormId, fields, config) : null),
    [chosenFormId, fields, config],
  )
  const titleField = primaryFieldOf(fields, config)
  const imageField = imageFieldOf(fields, config)

  const openEntry = entries.data?.find((entry) => entry.id === openEntryId) ?? null

  if (offered.isPending) {
    return (
      <StationChrome title="Components">
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </StationChrome>
    )
  }

  if (!spaceId) {
    return (
      <StationChrome title="Components">
        <p className="text-muted-foreground mx-auto max-w-xs p-6 text-center text-[13px] leading-relaxed">
          {offered.isError
            ? "The workspaces this station works in could not be loaded — this is not a list of none, it is a question that failed."
            : "None of your workspaces counts components right now. A workspace offers this station once it counts stock and somebody has given you the entries in it."}
        </p>
      </StationChrome>
    )
  }

  if (openEntry && chosenFormId) {
    return (
      <ComponentDetail
        entry={openEntry}
        formId={chosenFormId}
        spaceId={spaceId}
        fields={fields}
        titleFieldName={titleField?.name}
        imageFieldName={imageField?.name}
        countFieldName={count?.field?.name}
        countCandidates={(count?.candidates ?? []).map((field) => ({ name: field.name, label: field.label }))}
        onChooseCountField={(name) => {
          rememberCountField(chosenFormId, name)
          void form.refetch()
        }}
        queue={queue}
        onBack={() => setOpenEntryId(null)}
      />
    )
  }

  return (
    <StationChrome title="Components" offline={!queue.online} pendingCount={queue.pending.length}>
      <div className="flex flex-col">
        {/* One compact row: both pickers are set once a visit and should not each own a line. */}
        {(worksIn.length > 1 || (componentTypes.data?.length ?? 0) > 1) && (
          <div className="flex gap-2 px-3 pt-3">
            {worksIn.length > 1 && (
              <Select value={spaceId} onValueChange={setChosenSpaceId}>
                <SelectTrigger className="h-11 flex-1 text-[13px]">
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {worksIn.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(componentTypes.data?.length ?? 0) > 1 && (
              <Select value={chosenFormId ?? undefined} onValueChange={setFormId}>
                <SelectTrigger className="h-11 flex-1 text-[13px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {(componentTypes.data ?? []).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* ⚠️ Sticky, because it is the control used most and a store room list is long. */}
        <div className="bg-background sticky top-0 z-10 flex gap-2 p-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a component"
              className="h-11 pr-9 pl-9"
              // ⚠️ 16px stops iOS zooming the whole page in the moment the field takes focus. Anything
              // smaller and every tap on search shoves the layout sideways.
              style={{ fontSize: 16 }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQuery("")}
                className="text-muted-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant={scanning ? "default" : "outline"}
            size="icon-lg"
            aria-label="Scan a code"
            onClick={() => setScanning((open) => !open)}
          >
            <ScanLine />
          </Button>
        </div>

        {scanning && (
          <div className="px-3 pb-3">
            <CodeReader
              onCode={(code) => {
                setQuery(code)
                setScanning(false)
              }}
            />
          </div>
        )}

        <div className="px-3">
          <SetAsideList queue={queue} />
        </div>

        {entries.isPending ? (
          <div className="flex flex-col gap-2 px-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (entries.data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground px-6 py-10 text-center text-[13px] leading-relaxed">
            {query ? "Nothing matches that." : "Nothing of this type is counted here yet."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 px-3">
            {(entries.data ?? []).map((entry) => {
              const stored = count?.field ? entry.fieldValues[count.field.name] : undefined
              const delta = count?.field ? queue.pendingDeltaFor(entry.id, count.field.name) : 0
              const shown = delta === 0 ? stored : (applyDelta(stored, delta) ?? stored)

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setOpenEntryId(entry.id)}
                    // ⚠️ 64px tall. A row a thumb has to aim at is a row somebody mis-taps while walking.
                    className="border-border active:bg-accent flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px]">
                      {titleField ? (entry.fieldValues[titleField.name] ?? "—") : "—"}
                    </span>
                    {shown !== undefined && (
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[17px] font-medium tabular-nums">{shown}</span>
                        {delta !== 0 && (
                          // ⚠️ A number that looks settled and is not is worse than an obvious "waiting".
                          <Badge variant="secondary" className="text-[10px]">
                            pending
                          </Badge>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* ⚠️ Only where there is something to open. Told "open a component to choose" underneath "no
            entries yet", a reader is being given an instruction the screen just called impossible. */}
        {count?.source === "unknown"
          && (count?.candidates.length ?? 0) > 1
          && (entries.data?.length ?? 0) > 0 && (
            <p className="text-muted-foreground px-4 pt-3 text-[12px] leading-relaxed">
              This component type has more than one number and has not said which one is the count. Open a
              component to choose.
            </p>
          )}

        {chosenFormId && (
          <AddComponent
            open={adding}
            onOpenChange={setAdding}
            formId={chosenFormId}
            spaceId={spaceId}
            fields={fields}
            titleFieldName={titleField?.name}
            countFieldName={count?.field?.name}
            online={queue.online}
          />
        )}
      </div>
    </StationChrome>
  )
}

/**
 * The camera, and the typed field beside it.
 *
 * ⚠️ **The typed field is always there.** `BarcodeDetector` is missing from whole browsers and a
 * camera is missing from whole machines — a scanner that is useless without one is useless at a desk,
 * and a store room has plenty of stickers a camera cannot read at all.
 */
function CodeReader({ onCode }: { onCode: (code: string) => void }) {
  const [typed, setTyped] = useState("")
  const { videoRef, problem } = useCodeScanner({ onCode })

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-2">
      {problem ? (
        <p className="text-muted-foreground px-2 py-3 text-[12.5px] leading-relaxed">{problem}</p>
      ) : (
        <video ref={videoRef} className="bg-muted aspect-video w-full rounded-md object-cover" muted playsInline />
      )}

      <div className="flex gap-2">
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && typed.trim() && onCode(typed.trim())}
          placeholder="…or type what is printed"
          className="h-11"
          style={{ fontSize: 16 }}
        />
        <Button size="icon-lg" disabled={!typed.trim()} onClick={() => onCode(typed.trim())} aria-label="Use it">
          <Check />
        </Button>
      </div>
    </div>
  )
}

interface ComponentDetailProperties {
  entry: FormEntry
  formId: string
  spaceId: string
  fields: FieldDetail[]
  titleFieldName?: string
  imageFieldName?: string
  countFieldName?: string
  countCandidates: { name: string; label: string }[]
  onChooseCountField: (fieldName: string) => void
  queue: ReturnType<typeof useOfflineQueue>
  onBack: () => void
}

function ComponentDetail({
  entry,
  formId,
  spaceId,
  fields,
  titleFieldName,
  imageFieldName,
  countFieldName,
  countCandidates,
  onChooseCountField,
  queue,
  onBack,
}: ComponentDetailProperties) {
  const queryClient = useQueryClient()
  const [photographError, setPhotographError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const stored = countFieldName ? entry.fieldValues[countFieldName] : undefined
  const delta = countFieldName ? queue.pendingDeltaFor(entry.id, countFieldName) : 0
  const shown = delta === 0 ? stored : (applyDelta(stored, delta) ?? stored)

  const adjust = async (by: number) => {
    if (!countFieldName) {
      return
    }

    await queue.enqueue({
      kind: "adjust",
      spaceId,
      formId,
      entryId: entry.id,
      fieldName: countFieldName,
      delta: by,
      believedValue: stored ?? null,
    })

    await queryClient.invalidateQueries({ queryKey: ["station", "components"] })
  }

  return (
    <StationChrome
      title={titleFieldName ? (entry.fieldValues[titleFieldName] ?? "Component") : "Component"}
      offline={!queue.online}
      pendingCount={queue.pending.length}
      leading={
        <Button variant="ghost" size="icon-lg" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {imageFieldName && entry.fieldValues[imageFieldName] && (
          <img src={entry.fieldValues[imageFieldName]} alt="" className="max-h-56 w-full rounded-lg object-contain" />
        )}

        {imageFieldName && (
          <label className="border-border active:bg-accent flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-[13px]">
            <Camera className="size-4" />
            {photographError ?? "Take a photograph"}
            <input
              type="file"
              accept="image/*"
              // ⚠️ `capture` opens the camera directly on a phone and is ignored on a desktop, which is
              // the behaviour wanted in both places.
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                event.target.value = ""

                if (!file) {
                  return
                }

                // ⚠️ Refused before anything is written. A phone camera makes several megabytes a shot,
                // and a queue that silently fills the device's quota is a station that stops working
                // with no message anybody can read.
                if (file.size > LARGEST_QUEUED_PHOTOGRAPH) {
                  setPhotographError("That photograph is too large to keep offline — try a smaller one.")

                  return
                }

                setPhotographError(null)

                void queue
                  .enqueuePhotograph(
                    {
                      kind: "photograph",
                      spaceId,
                      formId,
                      entryId: entry.id,
                      fieldName: imageFieldName,
                      fileName: file.name || "photograph.jpg",
                      byteCount: file.size,
                    },
                    file,
                  )
                  .then(() => queryClient.invalidateQueries({ queryKey: ["station", "components"] }))
              }}
            />
          </label>
        )}

        {countFieldName ? (
          <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-4">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[12px]">In stock</p>
              <p className="text-3xl font-medium tabular-nums">{shown ?? "—"}</p>
              {delta !== 0 && (
                <p className="text-muted-foreground text-[12px]">
                  {delta > 0 ? `+${delta}` : delta} waiting to be sent
                </p>
              )}
            </div>
            {/* ⚠️ 56px targets, side by side. Somebody is doing this with one hand while holding a tray. */}
            <div className="flex shrink-0 items-center gap-3">
              <Button variant="outline" className="size-14" onClick={() => void adjust(-1)} aria-label="One fewer">
                <Minus className="size-6" />
              </Button>
              <Button variant="outline" className="size-14" onClick={() => void adjust(1)} aria-label="One more">
                <Plus className="size-6" />
              </Button>
            </div>
          </div>
        ) : countCandidates.length > 1 ? (
          <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
            <p className="text-[13px]">Which of these is the count?</p>
            <p className="text-muted-foreground text-[12px] leading-relaxed">
              This component type has several numbers and has not said which one to adjust. Choosing here
              remembers it on this device; setting it on the form itself makes it right for everybody.
            </p>
            <div className="flex flex-wrap gap-2">
              {countCandidates.map((candidate) => (
                <Button
                  key={candidate.name}
                  variant="outline"
                  className="h-11"
                  onClick={() => onChooseCountField(candidate.name)}
                >
                  {candidate.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            This component type has no number to count, so there is nothing to adjust here.
          </p>
        )}

        {editing ? (
          <EditComponent
            entry={entry}
            formId={formId}
            spaceId={spaceId}
            fields={fields}
            countFieldName={countFieldName}
            imageFieldName={imageFieldName}
            queue={queue}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <dl className="flex flex-col gap-3">
              {fields
                .filter(
                  (field) =>
                    field.status === "ACTIVE"
                    && field.usageType !== "PHANTOM"
                    && field.name !== imageFieldName
                    && field.name !== countFieldName,
                )
                .map((field) => {
                  const value = entry.fieldValues[field.name] ?? ""

                  return (
                    <div key={field.id} className="flex items-baseline justify-between gap-3">
                      {/* ⚠️ The field's LABEL, not its name. `min_stock_threshold` is a column name and
                          reading it on a phone is reading somebody's schema. */}
                      <dt className="text-muted-foreground shrink-0 text-[12px]">
                        {field.label || field.name}
                      </dt>
                      <dd className={cn("min-w-0 text-right text-[13px]", !value && "text-muted-foreground")}>
                        {value || "—"}
                      </dd>
                    </div>
                  )
                })}
            </dl>

            <Button variant="outline" className="h-11 w-full" onClick={() => setEditing(true)}>
              <Pencil />
              Edit the rest
            </Button>
          </>
        )}
      </div>
    </StationChrome>
  )
}
