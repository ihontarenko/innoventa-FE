import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Row,
  RowAction,
  RowGroup,
  RowKey,
  RowList,
  RowTitle,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@jmouse/ui"
import { LinkRow } from "@/components/LinkRow"
import { PageHeader } from "@/components/PageHeader"
import { ToggleChip } from "@/components/ToggleChip"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import {
  useMintShare,
  useRevokeShare,
  useSharingConfig,
  useUpdateSharePattern,
  useUpdateSharePolicy,
} from "@/hooks/useSharing"
import { embedSnippet, shareLinkUrl, sharingApi } from "@/api/sharing"
import type { ShareLinkKind, SharedResourceRow, SharedResourceType, SharingDashboard } from "@/api/sharing"

const TYPES: SharedResourceType[] = ["PAGE", "FORM", "ENTRY", "FILE"]
const LINK_KINDS: ShareLinkKind[] = ["SHARE", "OG", "CUSTOM"]

/**
 * Resource types whose share exposes an embeddable widget (the "Embed" tab in Manage).
 *
 * ⚠️ **It read `["CATEGORY"]`, a type that no longer exists** — so the Embed tab was offered for nothing
 * at all and the feature looked unbuilt. A form is the one public surface this product still embeds:
 * `/_/form/:token/embed` is a real route with a real page behind it.
 */
const EMBEDDABLE_TYPES: SharedResourceType[] = ["FORM"]

const KIND_LABEL: Record<ShareLinkKind, string> = {
  SHARE: "Share token",
  OG: "OG link",
  CUSTOM: "Custom link",
}

const KIND_HINT: Record<ShareLinkKind, string> = {
  SHARE: "The direct public link to this resource.",
  OG: "An unfurl short link with a rich preview card for chat / social.",
  CUSTOM: "A pretty, pattern-based permalink that renders in place.",
}

const TYPE_ICON: Record<SharedResourceType, string> = {
  PAGE: "📄",
  FORM: "📝",
  ENTRY: "🧾",
  FILE: "📎",
}

const KIND_ICON: Record<ShareLinkKind, string> = { SHARE: "🔗", OG: "🪧", CUSTOM: "✨" }

function resourceKey(resourceType: SharedResourceType, resourceId: string): string {
  return `${resourceType}:${resourceId}`
}

/**
 * Everything this installation has published, and the three shapes a published thing can be reached by.
 *
 * ⚠️ **One mechanism, three kinds of link.** A share token is the direct address, an OG link is the
 * short one that unfurls a preview card in chat, and a custom link is a pretty path somebody chose. They
 * are rows on the same resource rather than three features, which is why revoking the *share token*
 * takes the other two with it — the token is what the others resolve through.
 *
 * ⚠️ **The filter is a row of chips rather than the side panel the old screen had.** The shared
 * `FilterPanel` has not moved yet (`INVT-0053`); eight filters over one table do not need three hundred
 * pixels of chrome, and a chip row that says the same thing is not worth blocking this screen on.
 */
export function SharingPage() {
  const { data: config, isLoading } = useSharingConfig()

  const [managing, setManaging] = useState<{ resourceType: SharedResourceType; resourceId: string } | null>(null)
  const [sharingNew, setSharingNew] = useState(false)
  const [showingPatterns, setShowingPatterns] = useState(false)
  const [search, setSearch] = useState("")
  const [activeType, setActiveType] = useState<SharedResourceType | null>(null)
  const [activeKind, setActiveKind] = useState<ShareLinkKind | null>(null)

  const resources = useMemo(() => config?.resources ?? [], [config])

  const managedResource = useMemo(() => {
    if (!managing) {
      return null
    }

    return (
      resources.find(
        (resource) => resource.resourceType === managing.resourceType && resource.resourceId === managing.resourceId,
      ) ?? null
    )
  }, [managing, resources])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return resources.filter(
      (resource) =>
        (activeType === null || resource.resourceType === activeType) &&
        (activeKind === null || resource.links.some((link) => link.kind === activeKind)) &&
        (needle === "" || resource.title.toLowerCase().includes(needle)),
    )
  }, [resources, search, activeType, activeKind])

  // A resource whose every link was revoked drops out of the list — close its dialog.
  useEffect(() => {
    if (managing && config && !managedResource) {
      setManaging(null)
    }
  }, [managing, config, managedResource])

  if (isLoading || !config) {
    return (
      <>
        <PageHeader title="Sharing" description="Everything published, and how it is reached" />
        <Skeleton className="h-64 w-full" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Sharing"
        description="Everything published, and how it is reached"
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search resources…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button variant="outline" size="sm" onClick={() => setShowingPatterns(true)}>
              URL patterns
            </Button>
            <Button size="sm" onClick={() => setSharingNew(true)}>
              Share a resource
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-muted-foreground uppercase">Type</span>
          {TYPES.map((type) => (
            <ToggleChip
              key={type}
              active={activeType === type}
              onClick={() => setActiveType(activeType === type ? null : type)}
            >
              {TYPE_ICON[type]} {type} · {resources.filter((resource) => resource.resourceType === type).length}
            </ToggleChip>
          ))}

          <span className="mr-1 ml-3 text-[11px] text-muted-foreground uppercase">Link</span>
          {LINK_KINDS.map((kind) => (
            <ToggleChip
              key={kind}
              active={activeKind === kind}
              onClick={() => setActiveKind(activeKind === kind ? null : kind)}
            >
              {KIND_ICON[kind]} {KIND_LABEL[kind]} ·{" "}
              {resources.filter((resource) => resource.links.some((link) => link.kind === kind)).length}
            </ToggleChip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
            <span aria-hidden="true" className="text-2xl">
              🔗
            </span>
            <span className="text-sm font-medium">{resources.length === 0 ? "Nothing shared yet" : "No matches"}</span>
            <span className="max-w-md text-xs text-muted-foreground">
              {resources.length === 0
                ? "Use “Share a resource” to publish a category, page, form, entry or file."
                : "No shared resource matches the current filters."}
            </span>
          </div>
        ) : (
          /* ⚠️ **Rows rather than a table, and it is the shape that decides.** Every column but one held
             a badge, so the headings labelled nothing a reader was comparing — while the question this
             list answers is *which of these is the one I want*, which is a name and its marks. Opening
             one is the row's only action, so the row itself is the target. */
          <RowGroup tally={`${filtered.length} of ${resources.length}`}>
            <RowList>
              {filtered.map((resource) => (
                <Row
                  key={resourceKey(resource.resourceType, resource.resourceId)}
                  leading={
                    <>
                      <span aria-hidden="true" className="w-4 text-center">
                        {TYPE_ICON[resource.resourceType]}
                      </span>
                      <RowKey className="w-20">{resource.resourceType}</RowKey>
                    </>
                  }
                  trailing={
                    <>
                      {resource.links.map((link) => (
                        <Badge key={link.kind} variant={link.kind === "SHARE" ? "secondary" : "default"}>
                          {KIND_LABEL[link.kind]}
                        </Badge>
                      ))}
                      {resource.allowedOrigins.length > 0 && <Badge variant="outline">Origins</Badge>}
                      <RowAction>
                        <span className="text-[11px] text-muted-foreground">Manage ›</span>
                      </RowAction>
                    </>
                  }
                  onOpen={() => setManaging({ resourceType: resource.resourceType, resourceId: resource.resourceId })}
                >
                  <RowTitle>{resource.title}</RowTitle>
                </Row>
              ))}
            </RowList>
          </RowGroup>
        )}
      </div>

      {managedResource && <ManageDialog resource={managedResource} onClose={() => setManaging(null)} />}

      {sharingNew && (
        <ShareNewDialog
          config={config}
          onClose={() => setSharingNew(false)}
          onShared={(resourceType, resourceId) => {
            setSharingNew(false)
            setManaging({ resourceType, resourceId })
          }}
        />
      )}

      {showingPatterns && <PatternsDialog config={config} onClose={() => setShowingPatterns(false)} />}
    </>
  )
}

// ── Manage ───────────────────────────────────────────────────────────────────

function ManageDialog({ resource, onClose }: { resource: SharedResourceRow; onClose: () => void }) {
  const canEmbed = EMBEDDABLE_TYPES.includes(resource.resourceType)
  const [active, setActive] = useState<string>("SHARE")

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Manage — <strong>{resource.title}</strong>
          </DialogTitle>
          <DialogDescription>Three kinds of link on one resource, and who may embed it.</DialogDescription>
        </DialogHeader>

        <Tabs value={active} onValueChange={setActive}>
          <TabsList>
            {LINK_KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </TabsTrigger>
            ))}
            {canEmbed && <TabsTrigger value="embed">Embed</TabsTrigger>}
            <TabsTrigger value="origins">Origins</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {LINK_KINDS.includes(active as ShareLinkKind) && (
            <LinkKindPanel resource={resource} kind={active as ShareLinkKind} />
          )}
          {active === "embed" && <EmbedPanel resource={resource} />}
          {active === "origins" && <OriginsPanel resource={resource} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function LinkKindPanel({ resource, kind }: { resource: SharedResourceRow; kind: ShareLinkKind }) {
  const mintShare = useMintShare()
  const revokeShare = useRevokeShare()
  const { copied, copy } = useCopyFeedback()

  const [customPath, setCustomPath] = useState("")
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)

  const link = resource.links.find((candidate) => candidate.kind === kind)
  const isCustom = kind === "CUSTOM"

  const previewQuery = useQuery({
    queryKey: ["share-preview", resource.resourceType, kind, resource.resourceId, customPath],
    queryFn: () =>
      sharingApi
        .preview(resource.resourceType, kind, resource.resourceId, customPath || undefined)
        .then((response) => response.data.token),
    enabled: isCustom || !link,
    staleTime: 5_000,
  })

  async function save() {
    try {
      await mintShare.mutateAsync({
        kind,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        pattern: isCustom ? customPath || undefined : undefined,
      })
      toast.success(link ? `${KIND_LABEL[kind]} updated.` : `${KIND_LABEL[kind]} created.`)
      setCustomPath("")
    } catch {
      toast.error("Could not save the link.")
    }
  }

  async function revoke() {
    setConfirmingRevoke(false)

    try {
      if (kind === "SHARE") {
        // ⚠️ Revoking the access token unshares the resource entirely — the other links resolve through
        // it, so leaving them behind would be two addresses pointing at nothing.
        await Promise.all(
          resource.links.map((candidate) =>
            revokeShare.mutateAsync({
              resourceType: resource.resourceType,
              resourceId: resource.resourceId,
              kind: candidate.kind,
            }),
          ),
        )
        toast.success("Resource unshared.")
      } else {
        await revokeShare.mutateAsync({ resourceType: resource.resourceType, resourceId: resource.resourceId, kind })
        toast.success(`${KIND_LABEL[kind]} removed.`)
      }
    } catch {
      toast.error("Could not remove the link.")
    }
  }

  const previewToken = previewQuery.data

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>

      {link && <LinkRow label={KIND_LABEL[kind]} url={shareLinkUrl(link)} copied={copied} onCopy={() => copy(shareLinkUrl(link))} />}

      {isCustom ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Custom path {link ? "(type to change it)" : ""}</span>
            <Input
              className="h-8 font-mono text-sm"
              value={customPath}
              placeholder={link ? link.token : "e.g. blog/my-page or tools/{slug}"}
              onChange={(event) => setCustomPath(event.target.value)}
            />
          </label>

          {customPath && previewToken && (
            <p className="text-xs text-muted-foreground">
              Will be <code className="font-mono break-all">{`${window.location.origin}/${previewToken}`}</code>
            </p>
          )}

          <div className="flex justify-end gap-2">
            {link && <RevokeButton confirming={confirmingRevoke} label="Remove link" onAsk={() => setConfirmingRevoke(true)} onConfirm={revoke} />}
            <Button size="sm" disabled={mintShare.isPending || (Boolean(link) && !customPath)} onClick={save}>
              {link ? "Update custom link" : "Create custom link"}
            </Button>
          </div>
        </>
      ) : link ? (
        <div className="flex justify-end">
          <RevokeButton
            confirming={confirmingRevoke}
            label={kind === "SHARE" ? "Unshare resource" : "Remove link"}
            confirmLabel={
              kind === "SHARE" ? "Really unshare — every link goes with it" : `Really remove the ${KIND_LABEL[kind]}`
            }
            onAsk={() => setConfirmingRevoke(true)}
            onConfirm={revoke}
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {previewToken ? (
              <>
                Will be <code className="font-mono break-all">{previewToken}</code>
              </>
            ) : (
              "An opaque token will be generated."
            )}
          </p>
          <div className="flex justify-end">
            <Button size="sm" disabled={mintShare.isPending} onClick={save}>
              Generate {KIND_LABEL[kind].toLowerCase()}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/** Two presses for anything that takes an address away — a dead link is somebody else's broken page. */
function RevokeButton({
  confirming,
  label,
  confirmLabel,
  onAsk,
  onConfirm,
}: {
  confirming: boolean
  label: string
  confirmLabel?: string
  onAsk: () => void
  onConfirm: () => void
}) {
  if (confirming) {
    return (
      <Button variant="destructive" size="sm" onClick={onConfirm}>
        {confirmLabel ?? `Really ${label.toLowerCase()}`}
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={onAsk}>
      {label}
    </Button>
  )
}

function EmbedPanel({ resource }: { resource: SharedResourceRow }) {
  const { copied, copy } = useCopyFeedback()

  if (!resource.publicToken) {
    return (
      <p className="text-xs text-muted-foreground">
        Generate a <strong>Share token</strong> first — the embed widget renders that.
      </p>
    )
  }

  const snippet = embedSnippet(resource.publicToken)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Paste this on any site to embed the tree (Shadow-DOM widget, no iframe).
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px]">{snippet}</pre>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => copy(snippet)}>
          {copied ? "✓ Copied" : "Copy embed code"}
        </Button>
      </div>
    </div>
  )
}

function OriginsPanel({ resource }: { resource: SharedResourceRow }) {
  const updatePolicy = useUpdateSharePolicy()
  const [origins, setOrigins] = useState(resource.allowedOrigins.join("\n"))

  useEffect(() => {
    setOrigins(resource.allowedOrigins.join("\n"))
  }, [resource.allowedOrigins])

  async function save() {
    const list = origins
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)

    try {
      await updatePolicy.mutateAsync({
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        allowedOrigins: list,
      })
      toast.success("Embed allow-list saved.")
    } catch {
      toast.error("Could not save the allow-list.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Which sites may embed this resource. One origin per line; empty means any site.
      </p>
      <Textarea
        className="min-h-28 font-mono text-xs"
        value={origins}
        placeholder="https://example.com"
        onChange={(event) => setOrigins(event.target.value)}
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={updatePolicy.isPending} onClick={save}>
          Save allow-list
        </Button>
      </div>
    </div>
  )
}

// ── Share a resource ─────────────────────────────────────────────────────────

function ShareNewDialog({
  config,
  onClose,
  onShared,
}: {
  config: SharingDashboard
  onClose: () => void
  onShared: (resourceType: SharedResourceType, resourceId: string) => void
}) {
  const mintShare = useMintShare()

  const [type, setType] = useState<SharedResourceType>("PAGE")
  const [resourceId, setResourceId] = useState("")

  const typeConfig = config.types.find((entry) => entry.resourceType === type)
  const options = useMemo(() => typeConfig?.options ?? [], [typeConfig])

  useEffect(() => {
    if (options.length > 0 && !options.some((option) => option.id === resourceId)) {
      setResourceId(options[0].id)
    }

    if (options.length === 0) {
      setResourceId("")
    }
  }, [options, resourceId])

  async function share() {
    if (!resourceId) {
      return
    }

    try {
      await mintShare.mutateAsync({ kind: "SHARE", resourceType: type, resourceId })
      toast.success("Resource shared.")
      onShared(type, resourceId)
    } catch {
      toast.error("Could not share the resource.")
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share a resource</DialogTitle>
          <DialogDescription>
            Sharing mints the <strong>Share token</strong>; add OG and custom links, and an embed, from Manage.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Resource type</span>
          <PlainSelect value={type} onChange={(next) => setType(next as SharedResourceType)}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </PlainSelect>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Resource</span>
          <PlainSelect value={resourceId} disabled={options.length === 0} onChange={setResourceId}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            {options.length === 0 && <option value="">No {type.toLowerCase()}s available</option>}
          </PlainSelect>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!resourceId || mintShare.isPending} onClick={share}>
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── URL patterns ─────────────────────────────────────────────────────────────

function PatternsDialog({ config, onClose }: { config: SharingDashboard; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>URL patterns</DialogTitle>
          <DialogDescription>
            Per resource type and kind. Empty means an opaque token (Share / OG) or the built-in default (Custom).
            Reference a type's variables with <code className="font-mono break-all">{"{name}"}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {config.types.map((typeConfig) => (
            <section key={typeConfig.resourceType} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-[0.04em] uppercase">{typeConfig.resourceType}</span>
                {typeConfig.variables.map((variable) => (
                  <code key={variable} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {`{${variable}}`}
                  </code>
                ))}
              </div>

              {LINK_KINDS.map((kind) => (
                <PatternRow
                  key={kind}
                  resourceType={typeConfig.resourceType}
                  kind={kind}
                  stored={
                    config.patterns.find(
                      (entry) => entry.resourceType === typeConfig.resourceType && entry.kind === kind,
                    )?.pattern ?? ""
                  }
                />
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PatternRow({
  resourceType,
  kind,
  stored,
}: {
  resourceType: SharedResourceType
  kind: ShareLinkKind
  stored: string
}) {
  const updatePattern = useUpdateSharePattern()
  const [value, setValue] = useState(stored)

  useEffect(() => {
    setValue(stored)
  }, [stored])

  const dirty = value !== stored

  // ⚠️ The SHARE token is the direct `/_/{type}/{token}` address — a single URL segment — so an inner
  // `/` is refused up front. OG and CUSTOM may be multi-segment, which is the whole difference between
  // them and this one.
  const invalid = kind === "SHARE" && value.trim().replace(/^\/+|\/+$/g, "").includes("/")

  async function save() {
    if (invalid) {
      return
    }

    try {
      await updatePattern.mutateAsync({ resourceType, kind, pattern: value.trim() })
      toast.success("Pattern saved.")
    } catch {
      toast.error("Could not save the pattern.")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={kind === "SHARE" ? "secondary" : "default"} className="w-28 justify-center">
        {KIND_LABEL[kind]}
      </Badge>
      <Input
        className="h-8 flex-1 font-mono text-sm"
        value={value}
        placeholder={kind === "CUSTOM" ? "e.g. blog/{slug}" : "opaque token"}
        title={
          invalid
            ? "The Share token must be a single URL segment — no '/'. Use a Custom link for a pretty path."
            : undefined
        }
        onChange={(event) => setValue(event.target.value)}
      />
      {invalid && <span className="text-[11px] whitespace-nowrap text-destructive">single segment only</span>}
      <Button variant="ghost" size="sm" disabled={!dirty || invalid || updatePattern.isPending} onClick={save}>
        Save
      </Button>
    </div>
  )
}
