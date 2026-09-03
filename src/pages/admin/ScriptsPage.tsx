import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleQuestionMark, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Alert, AlertDescription, Badge, Button, Input, Label, NativeSelect, Skeleton, cn } from "@jmouse/ui"
import type { CompletionCatalogue } from "@jmouse/codemirror/completion"
import { PageHeader } from "@/components/PageHeader"
import { detailOf } from "@/lib/apiErrors"
import { useSpaces } from "@/hooks/useSpaces"
import { ScriptHelpDialog } from "@/components/scripts/ScriptHelpDialog"
import { ScriptSourcePane } from "@/components/scripts/ScriptSourcePane"
import {
  scriptsApi,
  type ScriptDocumentDetail,
  type ScriptDocumentRequest,
  type ScriptDocumentSummary,
  type ScriptLine,
  type ScriptRun,
} from "@/api/scripts"

/**
 * The workspace's jMS scripts — what should happen when an entry is written.
 *
 * ## ⚠️ The fourth question, and the first one with a screen
 *
 * Three jMouse dialects already have editors: `.jmp` answers *who may*, `.jmv` answers *what is valid*,
 * jME answers *what a value is*. *What should happen* was a Java class and a redeploy. This is where it
 * stops being one.
 *
 * ## ⚠️ This screen does not validate
 *
 * Every judgement on the page comes from the server: the gutter marks come from `POST /scripts/rehearse`
 * running the real parser and the real binder, and the red strip above the editor is a refusal recorded
 * at the last **boot** and stored on the row. A screen that decided a script was fine and was then
 * contradicted at save is worse than one that never guessed.
 *
 * ## ⚠️ A refusal on the rail, not only in the open document
 *
 * `REFUSED` means the catalogue changed underneath a document nobody edited — a facade method taken out
 * in a release. That is invisible by nature: nothing happened, somebody's rule simply stopped firing.
 * So the state is a mark on every row, and the rail is the first thing the page draws.
 *
 * ## ⚠️ Completion degrades, it does not block
 *
 * The catalogue is fetched apart from the documents and its failure is swallowed. With it unreachable
 * the editor still opens, still saves and still reverts, and simply offers nothing — which is the
 * behaviour the ticket asks for in as many words.
 */

/**
 * A document nobody has typed into yet — enough jMS to be a shape rather than a blank page.
 *
 * ⚠️ **It has to be a document the binder would actually accept.** The first draft of this constant
 * was a bare `on changed do … end` with no `script` block, so the very first thing anybody who pressed
 * New and then Save saw was a refusal — the parser doing its job, and a terrible first impression all
 * the same. A starter that does not compile teaches the wrong shape twice: once by example, once by
 * making the screen look broken.
 *
 * ⚠️ It handles `saving` rather than `changed` on purpose. `saving` is the only one of the four events
 * that carries the entry itself; `created`, `changed` and `deleting` carry an entry **id**, and
 * `@stock`'s methods take an entry — so a starter written against `changed` would bind and then fail
 * at the first write, which is the worst of the three possible outcomes.
 */
const REMEMBERED_SPACE = "innoventa.scripts.space"

const STARTER_SOURCE = `# ---------------------------------------------------------------------------
#  A rule: what should happen when an entry is written.
#
#  Every call this installation offers is shown below, commented. Delete what
#  you do not need — an empty handler costs nothing, but a rule nobody can read
#  costs somebody an afternoon.
#
#  The Help button beside New lists the same API, read live from the server.
# ---------------------------------------------------------------------------

script "starter" {

    # A value written once and called from anywhere in this document. The place
    # to put a threshold you would otherwise repeat — a number written in three
    # handlers is a number that will be changed in two.
    function floor()
        return 10
    end

    # ── saving ──────────────────────────────────────────────────────────────
    #
    # About to replace an entry's values. THE UPDATE PATH ONLY — a brand new
    # entry reaches \`created\` instead, so a rule written here never sees one.
    #
    # It hands you three names:
    #   entry     the entry as it is stored, right now
    #   incoming  the values about to replace them
    #   form      the form the entry belongs to
    #
    # \`when\` is a guard: false and the body does not run at all. Most forms in
    # a workspace are not stock positions, so ask before doing anything.
    on saving when @stock.isPosition(entry) do

        # @stock — reads through the bindings this workspace configured.
        #   quantity(entry)     how many are on the shelf, or nothing
        #   isPosition(entry)   whether this entry is a stock position at all
        #   label(entry)        what to call it in a message somebody reads
        local held = @stock.quantity(entry)

        if held < floor() then

            # @attention — puts something on the morning screen.
            #   raise(entry, mark, title, detail)          at ordinary urgency
            #   raise(entry, mark, title, detail, weight)  more urgent, clamped
            #   raiseById(entryId, mark, title, detail)    for created/changed/deleting
            #   clear(entry, mark)                         takes it back
            #
            # \`mark\` is your own name for this kind of item. Raising twice with
            # one mark updates one line rather than making a second — which is
            # what stops a rule that fires on every save from filling a screen.
            @attention.raise(entry, 'below-floor', @stock.label(entry), 'under its floor')

            # @log — how you find out what your rule is doing.
            #   info(message) / warn(message) / error(message)
            #
            # Every line goes to the server log AND to the Activity strip under
            # this editor, so you can watch a rule fire without leaving the page.
            @log.info('flagged a position under its floor')
        else

            # The half people forget. A rule that only ever raises leaves a
            # screen full of things that were true once.
            @attention.clear(entry, 'below-floor')
        end
    end

    # ── created ─────────────────────────────────────────────────────────────
    #
    # Stored for the first time. Not vetoable.
    # CARRIES AN ENTRY ID, not the entry — which is why @attention has
    # \`raiseById\`, and why @stock's methods cannot be used here.
    on created do
        @log.info('an entry was created')
    end

    # ── changed ─────────────────────────────────────────────────────────────
    #
    # Values have just been rewritten. Also an id only.
    on changed do
        @log.info('an entry changed')
    end

    # ── deleting ────────────────────────────────────────────────────────────
    #
    # About to be deleted, and anyone who would be broken by it may say so.
    # An id only.
    on deleting do
        @log.info('an entry is about to go')
    end
}
`

export function ScriptsPage() {
  const queryClient = useQueryClient()
  /**
   * ⚠️ **Remembered, and it took writing a rule into the wrong workspace to see why.**
   *
   * Left in component state alone, the choice resets to the first workspace on every mount — and a
   * mount happens on every hot reload and every return to the page. Somebody who picks a workspace,
   * types a rule, and presses Create can therefore save it somewhere they never chose, with nothing on
   * screen having changed to tell them. That is the whole accident, and it is one line to prevent.
   */
  const [spaceId, setSpaceId] = useState<string>(() => {
    try {
      return window.localStorage.getItem(REMEMBERED_SPACE) ?? ""
    } catch {
      return ""
    }
  })
  const [helpOpen, setHelpOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ScriptDocumentDetail | null>(null)

  const spaces = useSpaces()

  useEffect(() => {
    try {
      if (spaceId) {
        window.localStorage.setItem(REMEMBERED_SPACE, spaceId)
      }
    } catch {
      // A browser that refuses storage still gets a working screen, just a forgetful one.
    }
  }, [spaceId])

  // ⚠️ Chosen for the reader on first paint rather than left empty. An admin screen that opens
  // on "no workspace" and an empty rail is indistinguishable from one whose workspace has no scripts.
  useEffect(() => {
    if (!spaceId && spaces.data && spaces.data.length > 0) {
      setSpaceId(spaces.data[0].id)
    }
  }, [spaceId, spaces.data])

  const documents = useQuery({
    queryKey: ["scripts", spaceId],
    queryFn: () => scriptsApi.list(spaceId).then((response) => response.data),
    enabled: Boolean(spaceId),
  })

  const open = useQuery({
    queryKey: ["scripts", spaceId, openId],
    queryFn: () => scriptsApi.read(spaceId, openId!).then((response) => response.data),
    enabled: Boolean(spaceId && openId),
  })

  const history = useQuery({
    queryKey: ["scripts", spaceId, openId, "revisions"],
    queryFn: () => scriptsApi.history(spaceId, openId!).then((response) => response.data),
    enabled: Boolean(spaceId && openId),
  })

  /**
   * ⚠️ Its failure is swallowed rather than surfaced. A missing catalogue costs suggestions; telling
   * somebody about it in the middle of writing a rule costs their attention for no action they can take.
   */
  const catalogue = useQuery<CompletionCatalogue | null>({
    queryKey: ["scripts", "catalogue"],
    queryFn: () => scriptsApi.catalogue().then((response) => response.data).catch(() => null),
    staleTime: 5 * 60 * 1000,
  })

  /**
   * ⚠️ **Polled, and that is the point.** Everything else on this page describes what a rule *is*;
   * this is the only thing that says whether it has ever *run*. Somebody who has just saved a rule
   * goes and saves an entry in another tab and comes back — so the answer has to arrive without them
   * reloading, or they conclude the rule is dead when it is merely last-fetched.
   */
  const activity = useQuery({
    queryKey: ["scripts", spaceId, "activity"],
    queryFn: () => scriptsApi.activity(spaceId).then((response) => response.data),
    enabled: Boolean(spaceId),
    refetchInterval: 4000,
  })

  // ⚠️ The draft is seeded from the server's answer and then owned by the page. Deriving it on every
  // render would throw away what somebody is typing each time a background refetch lands.
  useEffect(() => {
    if (open.data) {
      setDraft(open.data)
    }
  }, [open.data])

  const save = useMutation({
    mutationFn: (request: ScriptDocumentRequest) =>
      openId
        ? scriptsApi.revise(spaceId, openId, request).then((response) => response.data)
        : scriptsApi.create(spaceId, request).then((response) => response.data),
    onSuccess: (saved) => {
      setOpenId(saved.id)
      setDraft(saved)
      queryClient.invalidateQueries({ queryKey: ["scripts"] })
    },
  })

  const revert = useMutation({
    mutationFn: (version: number) =>
      scriptsApi.revert(spaceId, openId!, version).then((response) => response.data),
    onSuccess: (reverted) => {
      setDraft(reverted)
      queryClient.invalidateQueries({ queryKey: ["scripts"] })
    },
  })

  const remove = useMutation({
    mutationFn: () => scriptsApi.remove(spaceId, openId!),
    onSuccess: () => {
      setOpenId(null)
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: ["scripts"] })
    },
  })

  const startNew = () => {
    setOpenId(null)
    setDraft({
      id: "",
      name: "",
      description: null,
      source: STARTER_SOURCE,
      enabled: true,
      sortOrder: nextSortOrder(documents.data),
      version: 0,
      bindState: "BOUND",
      bindProblem: null,
      budget: { steps: null, loopIterations: null, recursionDepth: null, deadlineMillis: null },
      createdAt: "",
      updatedAt: "",
    })
  }

  const failure = save.error ?? revert.error ?? remove.error

  return (
    <>
      <PageHeader
        title="Scripts"
        description="What should happen when an entry is written. A document belongs to this workspace and says for itself which forms it acts on."
      />

      {/* -mx-4 -mb-4 cancels the content box's padding so the rail's divider reaches the true edges.
          ⚠️ **-mt-4 cancels something else: the wrapper is a flex column with `gap-4`**, and the header
          is the child before this one — so without it a 16px band of page background sits between the
          header's bottom border and the rail, which reads as the screen having come unstuck from its
          own header. min-h-0 is what makes the fill real: a flex child defaults to its content's
          height, so without it the inner scrollers grow rather than scroll. */}
      {helpOpen && <ScriptHelpDialog onClose={() => setHelpOpen(false)} />}

      <div className="-mx-4 -mt-4 -mb-4 flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r">
          {/* ⚠️ **The workspace is named here, not inherited from wherever the reader last was.**
              This screen sits in the installation menu, so there is no ambient workspace to inherit —
              and even where there were one, a script runs on every write in the workspace it belongs
              to, which is not a thing to scope by browsing history. Switching this switches the rail,
              which is also the isolation being demonstrated rather than asserted. */}
          <div className="border-b px-3 py-2">
            <Label htmlFor="script-space" className="text-xs tracking-wide uppercase text-muted-foreground">
              Workspace
            </Label>
            {/* ⚠️ `NativeSelect`, not a bare `<select>` with a border class on it. The toolkit's one
                carries the field's height, radius and focus ring — and, less visibly, an opaque
                background, because Chromium paints the option list from the select's own computed
                colour rather than the page's. A hand-rolled one is a control that looks like nothing
                else in the product on a good theme and drops a white popup on a dark one. */}
            <NativeSelect
              id="script-space"
              size="sm"
              className="mt-1 w-full"
              value={spaceId}
              onChange={(event) => {
                // ⚠️ A draft belongs to the workspace it was written for, so switching has to discard
                // it — but never silently. Losing somebody's unsaved rule to a dropdown is the kind of
                // small betrayal that stops them trusting the screen with anything longer than a line.
                const unsaved = draft && !openId && draft.source.trim().length > 0

                if (unsaved && !window.confirm("Discard the rule you have not saved yet?")) {
                  return
                }

                setSpaceId(event.target.value)
                setOpenId(null)
                setDraft(null)
              }}
            >
              {spaces.data?.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Documents
            </span>
            <span className="flex items-center gap-1">
              {/* ⚠️ Beside New rather than in a corner. The moment somebody needs the syntax is the
                  moment they start a rule, and a reference they have to go looking for is one they
                  guess instead. */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHelpOpen(true)}
                aria-label="Syntax and the API a rule may reach"
                title="Syntax and the API a rule may reach"
              >
                <CircleQuestionMark className="size-4" />
              </Button>

              <Button size="sm" variant="ghost" disabled={!spaceId} onClick={startNew}>
                <Plus className="size-4" />
                New
              </Button>
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {documents.isLoading && <Skeleton className="m-3 h-20" />}

            {documents.data?.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">
                No scripts here yet. Entry writes in this workspace run exactly as they do today.
              </p>
            )}

            {documents.data?.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                active={document.id === openId}
                onOpen={() => setOpenId(document.id)}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!draft && (
            <p className="p-6 text-sm text-muted-foreground">
              Pick a document, or start a new one.
            </p>
          )}

          {draft && (
            <>
              <div className="flex flex-wrap items-end gap-3 px-3 py-2">
                <div className="min-w-48">
                  <Label htmlFor="script-name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="script-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="low-stock"
                  />
                </div>

                <div className="min-w-64 flex-1">
                  <Label htmlFor="script-description" className="text-xs">
                    What it is for
                  </Label>
                  <Input
                    id="script-description"
                    value={draft.description ?? ""}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    placeholder="Raise an attention item when a part goes under its floor"
                  />
                </div>

                <div className="w-24">
                  <Label htmlFor="script-order" className="text-xs">
                    Order
                  </Label>
                  <Input
                    id="script-order"
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft({ ...draft, sortOrder: Number(event.target.value) || 0 })
                    }
                  />
                </div>

                <label className="flex items-center gap-2 pb-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                  />
                  Enabled
                </label>

                <div className="flex items-center gap-2 pb-1">
                  <Button
                    size="sm"
                    disabled={!draft.name.trim() || save.isPending}
                    onClick={() => save.mutate(requestOf(draft))}
                  >
                    {openId ? "Save revision" : "Create"}
                  </Button>

                  {openId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate()}
                      aria-label="Delete this document and its history"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* ⚠️ The refusal recorded at the last boot, above the text it is about. It is not the
                  same thing as the gutter marks below: this one says the build changed underneath a
                  document nobody edited. */}
              {draft.bindState === "REFUSED" && draft.bindProblem && (
                <Alert variant="destructive" className="mx-3 mb-2">
                  <AlertDescription className="font-mono text-xs">
                    This document did not bind at the last start and is not running. {draft.bindProblem}
                  </AlertDescription>
                </Alert>
              )}

              {failure && (
                <Alert variant="destructive" className="mx-3 mb-2">
                  <AlertDescription className="font-mono text-xs">
                    {messageOf(failure)}
                  </AlertDescription>
                </Alert>
              )}

              <ScriptSourcePane
                name={draft.name}
                source={draft.source}
                catalogue={catalogue.data ?? null}
                onChange={(next) => setDraft({ ...draft, source: next })}
              />

              {openId && draft.name && (
                <ScriptActivityStrip
                  run={activity.data?.documents.find((entry) => entry.document === draft.name)}
                  lines={(activity.data?.lines ?? []).filter((line) => line.document === draft.name)}
                />
              )}

              {openId && history.data && history.data.revisions.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs">
                  <span className="tracking-wide uppercase text-muted-foreground">History</span>

                  {history.data.revisions.map((revision) => (
                    <button
                      key={revision.version}
                      type="button"
                      className="flex items-center gap-1 border px-1.5 py-0.5 hover:bg-accent disabled:opacity-50"
                      disabled={revision.version === draft.version || revert.isPending}
                      onClick={() => revert.mutate(revision.version)}
                      title={revision.note ?? `Revision ${revision.version}`}
                    >
                      <RotateCcw className="size-3" />v{revision.version}
                    </button>
                  ))}

                  {/* ⚠️ Said out loud, because the button does not do what "revert" usually means. */}
                  <span className="text-muted-foreground">
                    Going back writes a new revision — nothing is deleted.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}

/**
 * Whether this rule is firing, and what it said while it did.
 *
 * ⚠️ **Never fired** is drawn as loudly as a failure, because it is the more common fault and the one
 * with no other symptom. A rule that binds, is enabled, and is simply never called looks — from every
 * other part of this screen — exactly like a rule that is working.
 */
function ScriptActivityStrip({ run, lines }: { run?: ScriptRun; lines: ScriptLine[] }) {
  const never = !run || run.runs === 0

  return (
    <div className="border-t px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="tracking-wide uppercase text-muted-foreground">Activity</span>

        {never && (
          <span className="text-warning">
            Has not run yet — save an entry in this workspace to fire it.
          </span>
        )}

        {!never && (
          <>
            <span>
              ran <strong>{run.runs}</strong>× · last on <code>{run.lastEvent}</code>
              {run.lastRunAt && <> at {run.lastRunAt.slice(11, 19)}</>}
            </span>
            {run.failures > 0 && (
              <span className="text-destructive">
                {run.failures} failed — ⚠️ a failing rule takes the entry write with it
              </span>
            )}
          </>
        )}
      </div>

      {lines.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto border-t pt-2 font-mono">
          {lines.map((line, index) => (
            <li key={`${line.at}-${index}`} className="flex gap-2">
              <span className="text-muted-foreground">{line.at.slice(11, 19)}</span>
              <span className={cn(line.level === "ERROR" && "text-destructive", line.level === "WARN" && "text-warning")}>
                {line.level}
              </span>
              <span className="truncate">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One row of the rail.
 *
 * ⚠️ Three states, and the third is the one worth drawing: bound, switched off, and *refused* — which
 * looks like nothing at all from the outside.
 */
function DocumentRow({
  document,
  active,
  onOpen,
}: {
  document: ScriptDocumentSummary
  active: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left hover:bg-accent",
        active && "bg-accent",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <span className="truncate text-sm">{document.name}</span>

        {document.bindState === "REFUSED" && (
          <Badge variant="destructive" className="ml-auto">
            refused
          </Badge>
        )}

        {document.bindState === "BOUND" && !document.enabled && (
          <Badge variant="outline" className="ml-auto">
            off
          </Badge>
        )}
      </span>

      <span className="truncate text-xs text-muted-foreground">
        {document.description || `revision ${document.version}`}
      </span>
    </button>
  )
}

/** Put a new document after the ones that exist, rather than tied with the first at zero. */
function nextSortOrder(documents: ScriptDocumentSummary[] | undefined): number {
  if (!documents || documents.length === 0) {
    return 0
  }

  return Math.max(...documents.map((document) => document.sortOrder)) + 10
}

function requestOf(draft: ScriptDocumentDetail): ScriptDocumentRequest {
  return {
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    source: draft.source,
    enabled: draft.enabled,
    sortOrder: draft.sortOrder,
    budget: draft.budget,
    note: null,
  }
}

/**
 * ⚠️ The server's own sentence, through the module that already knows where it lives.
 *
 * This read `response.data.message` at first and printed "the server said nothing useful" over a
 * perfectly good refusal: the API answers RFC 7807 `ProblemDetail`, whose sentence is `detail`. The
 * refusal is the one part of a failed save worth showing — it carries the line, the column and the name
 * the host did not know — so losing it to a wrong field name is the worst small bug this screen could
 * have had.
 */
function messageOf(failure: unknown): string {
  return detailOf(failure) ?? "The save was refused and the server said nothing useful."
}
