import { useState } from "react"
import {
  Badge,
  Button,
  cn,
  Input,
  Row,
  RowAction,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
  Switch,
} from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import {
  useDiscardOwnAgent,
  useEveryAgent,
  useRenameAgent,
  useRevokeAgentConnection,
  useSetAgentAuthority,
  useSetAgentEnabled,
} from "@/hooks/useAiAdministration"
import type { AgentAuthority, AgentConnection, AgentSurface, AgentView } from "@/api/ai"
import { readableDate } from "@/lib/dates"
import { AgentGrantsEditor } from "./AgentGrantsEditor"

/**
 * Every agent this installation has, what each may do, and which clients hold a credential for one.
 *
 * ⚠️ **The two controls on each row do different things, and the screen has to say so.** *May act* is
 * whether it may do anything **at all**; the authority line is **how much**. Confusing them is how
 * somebody restricts an agent expecting it to stop, or switches one off expecting it merely to be
 * careful.
 *
 * Cards rather than a table, because each agent has a nested list of clients under it and a table with a
 * list in one cell has stopped being a table.
 */
export function AgentsPanel({ surface = "everyone", heading = true }: { surface?: AgentSurface; heading?: boolean }) {
  const mine = surface === "mine"
  const agents = useEveryAgent(surface)

  if (agents.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  if (!agents.data || agents.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
        <span aria-hidden="true" className="text-2xl">
          🤖
        </span>
        <span className="text-sm font-medium">{mine ? "You have no agents yet" : "No agent has ever connected"}</span>
        <span className="max-w-lg text-xs text-muted-foreground">
          {mine
            ? "Create one to give an assistant access without handing over your account, or connect a client and one appears here on its own."
            : "An agent appears here once one exists and has been used. Nothing is listed in advance, because an agent nobody connected is a switch with nothing behind it."}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {heading && <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Agents</h2>}

      {agents.data.map((agent) => (
        <AgentCard key={agent.id} agent={agent} surface={surface} />
      ))}
    </div>
  )
}

function AgentCard({ agent, surface }: { agent: AgentView; surface: AgentSurface }) {
  const setEnabled = useSetAgentEnabled(surface)
  const setAuthority = useSetAgentAuthority(surface)
  const revoke = useRevokeAgentConnection(surface)
  const discard = useDiscardOwnAgent()

  // Held locally so the warning appears BEFORE the change rather than as a toast after it. Restricting
  // an agent that has been granted nothing leaves it able to do nothing, and that is exactly the thing
  // somebody has to be told while they can still change their mind.
  const [confirming, setConfirming] = useState(false)

  // ⚠️ Closed by default, and the pane's query is gated on it: an installation with twenty agents would
  // otherwise resolve twenty owners' whole permission sets to fill panes nobody opened.
  const [grantsOpen, setGrantsOpen] = useState(false)

  const [discarding, setDiscarding] = useState(false)

  const live = agent.connections.filter((connection) => !connection.revokedAt)
  const ended = agent.connections.filter((connection) => connection.revokedAt)

  function change(authority: AgentAuthority) {
    setConfirming(false)
    setAuthority.mutate({ agentId: agent.id, authority })
  }

  return (
    <section className={cn("flex flex-col gap-2 rounded-md border p-3", !agent.enabled && "opacity-70")}>
      <header className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true">🤖</span>
        <AgentName agent={agent} surface={surface} />
        <AuthorityChip authority={agent.authority} />
        {!agent.enabled && <Badge variant="outline">switched off</Badge>}

        <div className="ml-auto flex items-center gap-3">
          {/* ⚠️ Labelled, not a bare toggle. "May act" and "Restricted" are two controls a few
              centimetres apart meaning AT ALL and HOW MUCH; an unlabelled one invites the wrong one. */}
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">May act</span>
            <Switch
              checked={agent.enabled}
              disabled={setEnabled.isPending}
              onCheckedChange={(enabled) => setEnabled.mutate({ agentId: agent.id, enabled })}
            />
          </label>

          {/* ⚠️ Offered only on somebody's own, and never on the administration screen. Discarding
              somebody else's agent is indistinguishable afterwards from their having done it, and the
              switch beside it stops one just as completely while leaving it possible to explain. */}
          {surface === "mine" &&
            (discarding ? (
              <Button variant="destructive" size="sm" onClick={() => discard.mutate(agent.id)}>
                Really discard — everything it created stays with your account
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDiscarding(true)}
              >
                Discard
              </Button>
            ))}
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        {agent.connectionCount === 0
          ? "no live client"
          : `${agent.connectionCount} live client${agent.connectionCount === 1 ? "" : "s"}`}
        {" · "}
        {agent.lastActiveAt ? `last acted ${readableDate(agent.lastActiveAt)}` : "has never acted"}
      </p>

      {confirming ? (
        <Callout tone="warning">
          <span>
            <strong>It will hold nothing until you grant it something.</strong> A restricted agent acts with its own
            permissions. From its next call it can do only what it has been granted — which its owner will read as a
            broken connection unless somebody grants it something first.
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={setAuthority.isPending} onClick={() => change("RESTRICTED")}>
              Restrict it anyway
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Leave it as it is
            </Button>
          </div>
        </Callout>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-2xl text-xs text-muted-foreground">
            {agent.authority === "RESTRICTED"
              ? "Holds its own permissions — its own, and nothing implied. Not capped by its owner: it may hold what the account it acts for does not."
              : "Acts with everything its owner can do, and follows them into new places."}
          </span>

          <div className="ml-auto flex gap-2">
            {agent.authority === "RESTRICTED" && (
              <Button variant="ghost" size="sm" onClick={() => setGrantsOpen((open) => !open)}>
                {grantsOpen ? "Hide what it holds" : "Set what it holds"}
              </Button>
            )}

            {agent.authority === "RESTRICTED" ? (
              <Button variant="ghost" size="sm" disabled={setAuthority.isPending} onClick={() => change("INHERITED")}>
                Give it its owner's access
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled={setAuthority.isPending} onClick={() => setConfirming(true)}>
                Restrict it
              </Button>
            )}
          </div>
        </div>
      )}

      {agent.authority === "RESTRICTED" && <AgentGrantsEditor surface={surface} agentId={agent.id} expanded={grantsOpen} />}

      {agent.connections.length > 0 && (
        <RowGroup label="Clients" tally={`${live.length} live · ${ended.length} ended`}>
          <RowList>
            {[...live, ...ended].map((connection) => (
              <Row
                key={connection.id}
                tone={connection.revokedAt ? "muted" : undefined}
                leading={<span aria-hidden="true">{connection.revokedAt ? "⚯" : "⚭"}</span>}
                trailing={
                  <>
                    <RowMeta>{describeUsage(connection)}</RowMeta>
                    {!connection.revokedAt && (
                      <RowAction>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate({ agentId: agent.id, connectionId: connection.id })}
                        >
                          Disconnect
                        </Button>
                      </RowAction>
                    )}
                  </>
                }
              >
                <RowTitle className={cn(connection.revokedAt && "line-through")}>{connection.clientName}</RowTitle>
              </Row>
            ))}
          </RowList>
        </RowGroup>
      )}
    </section>
  )
}

/**
 * What the agent is called, and the one place it can be corrected.
 *
 * ⚠️ **Why a rename has to be offered at all.** An agent is named after the client that first connected
 * to it, and a client's name is a **claim it made about itself** during registration — one it may not
 * have made at all. A client that sent nothing is called *An unnamed client*, and that string then
 * follows the agent through every record it touches.
 *
 * ⚠️ Escape cancels and an empty name is refused — an agent with no name is a row nobody can point at,
 * which is the state this control exists to get out of rather than into.
 */
function AgentName({ agent, surface }: { agent: AgentView; surface: AgentSurface }) {
  const rename = useRenameAgent(surface)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  function save() {
    const wanted = draft.trim()

    setEditing(false)

    if (wanted !== "" && wanted !== agent.name) {
      rename.mutate({ agentId: agent.id, name: wanted })
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        maxLength={120}
        className="h-7 w-56 text-sm"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save()
          }

          if (event.key === "Escape") {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      title="Rename"
      className="group flex items-center gap-1"
      onClick={() => {
        setDraft(agent.name)
        setEditing(true)
      }}
    >
      <strong className="text-sm">{agent.name}</strong>
      <span aria-hidden="true" className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
        ✎
      </span>
    </button>
  )
}

/** Quiet for the default, marked for the exception — the same chip the other product shows. */
function AuthorityChip({ authority }: { authority: AgentAuthority }) {
  const restricted = authority === "RESTRICTED"

  return <Badge variant={restricted ? "default" : "outline"}>{restricted ? "Restricted" : "Full access"}</Badge>
}

function describeUsage(connection: AgentConnection): string {
  if (connection.revokedAt) {
    return `ended ${readableDate(connection.revokedAt)}`
  }

  return connection.lastUsedAt ? `used ${readableDate(connection.lastUsedAt)}` : "never used"
}
