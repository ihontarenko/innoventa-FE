import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Copy, Download, TriangleAlert } from "lucide-react"
import { Badge, Button, Input, Skeleton } from "@jmouse/ui"
import { kicadApi, type IssuedKiCadToken, type KiCadTokenSummary } from "@/api/kicad"
import { readableMoment } from "@/lib/dates"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * Connecting a schematic editor to this workspace's catalogue.
 *
 * ⚠️ **A credential here reads the whole catalogue, forever, from a plaintext file.** The screen says so
 * rather than leaving somebody to find out: the editor stores what it is given unencrypted beside the
 * project, so the one mistake worth preventing is that file going into a repository.
 *
 * ⚠️ **The list is a history, not an inventory.** Revoked credentials stay on it — a row that vanished
 * cannot tell anybody it once existed, and "was this ever connected" is exactly the question somebody
 * asks after revoking one.
 */
export function KiCadSection({ space, isAdmin }: SpaceSettingsContext) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [issued, setIssued] = useState<IssuedKiCadToken | null>(null)

  const { data: tokens = [], isLoading } = useQuery<KiCadTokenSummary[]>({
    queryKey: ["spaces", space.id, "kicad-tokens"],
    queryFn: () => kicadApi.tokens(space.id).then((response) => response.data),
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["spaces", space.id, "kicad-tokens"] })

  const issue = useMutation({
    mutationFn: () => kicadApi.issue(space.id, name.trim()).then((response) => response.data),
    onSuccess: (result) => {
      setIssued(result)
      setName("")
      void refresh()
    },
    onError: () => toast.error("That was not issued — nothing was changed."),
  })

  const revoke = useMutation({
    mutationFn: (tokenId: string) => kicadApi.revoke(space.id, tokenId),
    onSuccess: () => {
      toast.success("Revoked — the editor stops at its next request.")
      void refresh()
    },
    onError: () => toast.error("That was not revoked — nothing was changed."),
  })

  return (
    <Section
      title="KiCad library"
      hint="A schematic editor can browse this workspace's parts. It reads names, never drawings."
    >
      {/*
        ⚠️ Two warnings, and neither is decoration. The first is about where the credential ends up; the
        second saves a support conversation nobody could otherwise diagnose, because a category that has
        not appeared looks exactly like a category that was never created.
      */}
      <div className="flex flex-col gap-2 rounded border-l-2 border-amber-500 bg-muted/40 px-3 py-2.5 text-xs">
        <p className="flex gap-2">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <span>
            The file you save carries a key that reads this whole catalogue, and KiCad stores it
            unencrypted beside your project. <strong>Keep it out of your repository.</strong>
          </span>
        </p>
        <p className="pl-[1.375rem] text-muted-foreground">
          KiCad reads the list of component types once, when the Symbol Chooser opens. A type added
          after that appears when KiCad is restarted — not when the page is refreshed.
        </p>
      </div>

      {issued && (
        <IssuedCredential issued={issued} spaceName={space.name} onDismiss={() => setIssued(null)} />
      )}

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="kicad-token-name">
            Name it for the machine that will use it
          </label>
          <Input
            id="kicad-token-name"
            value={name}
            disabled={!isAdmin}
            placeholder="my laptop"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button disabled={!isAdmin || !name.trim() || issue.isPending} onClick={() => issue.mutate()}>
          Issue
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : tokens.length === 0 ? (
        <p className="rounded border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          Nothing issued yet. A credential is what lets KiCad see this workspace at all.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex items-center gap-3 rounded border border-border px-3 py-2 text-xs"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{token.name}</span>
                <span className="text-muted-foreground">
                  Issued {readableMoment(token.createdAt)}
                  {" · "}
                  {/* ⚠️ Never used is its own answer, and the one that makes revoking safe to press. */}
                  {token.lastUsedAt ? `last used ${readableMoment(token.lastUsedAt)}` : "never used"}
                </span>
              </div>

              {token.revokedAt ? (
                <Badge variant="secondary">revoked {readableMoment(token.revokedAt)}</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={!isAdmin || revoke.isPending}
                  onClick={() => revoke.mutate(token.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/**
 * The one and only sight of a credential.
 *
 * ⚠️ **It is dismissed rather than closed on a timer or on the next render.** Somebody who has not saved
 * the file yet must not lose it to a background refetch, and there is no second chance to hand them.
 */
function IssuedCredential({
  issued,
  spaceName,
  onDismiss,
}: {
  issued: IssuedKiCadToken
  spaceName: string
  onDismiss: () => void
}) {
  function download() {
    const blob = new Blob([issued.configuration], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `${fileNameOf(spaceName)}.kicad_httplib`
    anchor.click()

    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-primary/40 bg-primary/5 px-3 py-3">
      <p className="text-xs font-medium">
        “{issued.name}” is issued. This is the only time it can be shown.
      </p>

      <code className="block overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-[11px]">
        {issued.value}
      </code>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={download}>
          <Download className="mr-1 size-3.5" />
          Download .kicad_httplib
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            navigator.clipboard
              .writeText(issued.value)
              .then(() => toast.success("Copied"))
              .catch(() => toast.error("Could not copy — select it and copy by hand."))
          }
        >
          <Copy className="mr-1 size-3.5" />
          Copy the key
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          I have saved it
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        In KiCad: Preferences → Manage Symbol Libraries → add the downloaded file.
      </p>
    </div>
  )
}

/**
 * ⚠️ A file name, not a slug of one. The extension is what KiCad recognises the file by, so the stem is
 * only stripped of the characters a filesystem refuses — anything more and a workspace called “Лабораторія”
 * downloads as an empty name.
 */
function fileNameOf(spaceName: string) {
  const cleaned = spaceName.replace(/[\\/:*?"<>|]/g, "").trim()
  return cleaned.length > 0 ? cleaned : "innoventa"
}
