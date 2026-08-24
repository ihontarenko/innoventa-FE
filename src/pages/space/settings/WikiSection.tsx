import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, Button, Skeleton } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { connectIdentity, hasIdentityConnection } from "@/auth/identityAuth"
import { flattenKiwiTree, getKiwiTree } from "@/api/kiwi"
import { isKiwiUnreachable } from "@/api/kiwiClient"
import { useUpdateSpace } from "@/hooks/useSpaceSettings"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * Which branch of **Kiwi** this workspace's Pages screen shows (INVT-0120; `KW-1` §2, §3).
 *
 * <h2>⚠️ A workspace, and not a person or an installation</h2>
 *
 * The live blocks decide this rather than taste: `:::stock` and `:::bom` read the **active workspace's**
 * inventory. A page full of those directives means nothing outside a workspace, so the branch it lives
 * in belongs to one.
 *
 * <h2>⚠️ Choosing a branch grants nobody anything</h2>
 *
 * It narrows what is **shown**. Who may read a section is decided in Kiwi, per section, by its own
 * grants — a member without one opens this workspace's Pages screen and sees an empty tree, exactly as
 * they would in Kiwi. Saying otherwise on this screen would be a second authority, and two authorities
 * cannot guarantee that a refusal wins.
 *
 * <h2>⚠️ Two branches may point at one section, and that is allowed</h2>
 *
 * Kiwi's categories are **bare** — no owner, nothing naming which product a section belongs to
 * (`KW-1` §2). A shared handbook, read by two workspaces, is a real arrangement rather than a mistake to
 * guard against.
 *
 * <h2>⚠️ Kiwi being absent is an ordinary state here, and it has three flavours</h2>
 *
 * | | |
 * |---|---|
 * | no Identity token in this browser | the picker cannot list anything — offer the connection |
 * | connected, Kiwi unreachable | say so, and do not draw an empty picker |
 * | connected, nothing granted | an empty list, which is the honest answer |
 *
 * The middle one is the trap: an empty picker reading as *"Kiwi has no sections"* is worse than an
 * error, because it would have somebody conclude the wiki is empty and go and build a second one.
 */
export function WikiSection({ space, isAdmin }: SpaceSettingsContext) {
  const updateSpace = useUpdateSpace()

  // ⚠️ Asked of the BROWSER, not inferred from the answer. Kiwi's tree replies 200-with-nothing to an
  // anonymous caller, so "not connected" and "nothing granted" are the same response — see
  // hasIdentityConnection.
  const connected = useQuery({ queryKey: ["identity-connection"], queryFn: hasIdentityConnection })

  const tree = useQuery({
    queryKey: ["kiwi-tree"],
    queryFn: getKiwiTree,
    enabled: connected.data === true,
    // One honest sentence beats three attempts at the same outage.
    retry: false,
  })

  function choose(categoryId: string) {
    // ⚠️ The empty string is the CLEAR, not a no-op — see `spaceSettingsApi.update`. Omitting the key
    // would leave the old branch in place, which is the opposite of what "None" means on screen.
    updateSpace.mutate(
      { spaceId: space.id, kiwiRootCategoryId: categoryId },
      {
        onSuccess: () =>
          toast.success(categoryId ? "This workspace now reads that branch" : "This workspace has no wiki"),
      },
    )
  }

  const disconnected = connected.data === false
  const unreachable = tree.isError && isKiwiUnreachable(tree.error)
  // ⚠️ READABLE ones, not every node. The tree carries breadcrumbs — ancestors of a granted branch,
  // with nothing in them (KW-1 §4) — so a tree of three breadcrumbs and no grant is still "nothing
  // has been shared with you", and counting raw nodes would say otherwise.
  const offered = flattenKiwiTree(tree.data ?? []).filter(({ node }) => node.readable)

  return (
    <Section title="Wiki" hint="Which branch of Kiwi this workspace's pages come from">
      {/* ⚠️ One <p>, not loose text beside a <strong>. Callout lays its children out as a flex COLUMN,
          so every top-level node becomes its own row — which broke this sentence into three lines with
          an orphaned comma. */}
      <Callout tone="info">
        <p>
          Pages are <strong>Kiwi's</strong>, not this product's. Pointing a workspace at a branch decides
          what its Pages screen shows — never who may read it. That stays Kiwi's answer, per section, and
          a member without a grant there sees an empty tree here.
        </p>
      </Callout>

      {connected.isLoading || tree.isLoading ? (
        <Skeleton className="h-10 w-full max-w-md" />
      ) : disconnected ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Connect Identity to list Kiwi's sections. It is a separate account from the one you signed in
            with here, and connecting it changes nothing about this workspace.
          </p>
          <Button type="button" onClick={() => void connectIdentity(window.location.pathname)}>
            Connect Identity
          </Button>
        </div>
      ) : unreachable ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Kiwi is down or unreachable, so its sections cannot be listed right now. Whatever this
            workspace already points at is untouched.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          <PlainSelect
            value={space.kiwiRootCategoryId ?? ""}
            onChange={choose}
            disabled={!isAdmin || updateSpace.isPending}
          >
            <option value="">None — this workspace has no wiki</option>

            {/* ⚠️ Only readable sections. A node with `readable: false` is a breadcrumb — an ancestor
                of a branch this administrator holds, carried so the tree has a path down to it
                (`KW-1` §4). Choosing one would point the wiki at a section nobody, including the person
                choosing it, can open. */}
            {offered.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {" ".repeat(depth * 3)}
                {node.name}
              </option>
            ))}
          </PlainSelect>

          {offered.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nothing in Kiwi has been shared with you. That is an answer rather than a fault — sections
              are granted there, and until one is, there is nothing to point at.
            </p>
          )}
        </div>
      )}

      {/* ⚠️ A link and not controls: making, renaming, moving and deleting a section happen in Kiwi,
          where the grants that govern them are visible. Offering those here would be offering somebody
          a button whose refusal this product cannot explain. */}
      <a
        href={`${window.location.protocol}//${window.location.hostname}:5070`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3" />
        Manage sections in Kiwi
      </a>

    </Section>
  )
}
