import { useEffect, useMemo, useState } from "react"
import { Button, Skeleton } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { ToggleChip } from "@/components/ToggleChip"
import { useAgentGrants, useReplaceAgentGrants } from "@/hooks/useAiAdministration"
import type { AgentOffer, AgentPlacement, AgentSurface } from "@/api/ai"

/**
 * What a restricted agent holds — the pane behind the *Restrict it* button.
 *
 * ⚠️ **Permissions, places and roles all cross the port as opaque strings**, so neither this component
 * nor the library it talks to knows that a place is a workspace here and a project there. The visual
 * language is each product's own; the shape is not.
 *
 * ⚠️ **Flat, at thirteen permissions and at eighty-nine.** This briefly had a scroll box, per-namespace
 * headings, a filter and a Clear button. Each was a reasonable answer to "there are a lot of them";
 * together they made a pane that had to be read before it could be used. Small chips wrap, and rows of
 * one thing beat chrome around a window onto the same thing.
 *
 * ⚠️ **Offered rather than free-typed, and the offer is the owner's set.** A permission the owner does
 * not hold reads, from outside, exactly like the agent being broken.
 *
 * ⚠️ **Saved as a whole set, and only on the button.** Toggling a chip changes a draft; nothing reaches
 * the server until *Save*, so a half-built set is never briefly in force.
 */
export function AgentGrantsEditor({
  surface,
  agentId,
  expanded,
}: {
  surface: AgentSurface
  agentId: string
  expanded: boolean
}) {
  const grants = useAgentGrants(surface, agentId, expanded)
  const save = useReplaceAgentGrants(surface, agentId)

  const [permissions, setPermissions] = useState<string[]>([])
  const [placements, setPlacements] = useState<AgentPlacement[]>([])

  const held = grants.data?.held

  // Re-seeded whenever the server's answer changes — which includes a save's own response, so the draft
  // and what is in force cannot drift apart after one.
  useEffect(() => {
    if (held) {
      setPermissions(held.permissions)
      setPlacements(held.placements)
    }
  }, [held])

  const dirty = useMemo(() => {
    if (!held) {
      return false
    }

    return (
      !sameSet(held.permissions, permissions) ||
      !sameSet(held.placements.map(describePlacement), placements.map(describePlacement))
    )
  }, [held, permissions, placements])

  function togglePermission(permission: string) {
    setPermissions((current) =>
      current.includes(permission) ? current.filter((chosen) => chosen !== permission) : [...current, permission],
    )
  }

  function undo() {
    setPermissions(held?.permissions ?? [])
    setPlacements(held?.placements ?? [])
  }

  if (!expanded) {
    return null
  }

  if (grants.isLoading) {
    return <Skeleton className="h-24 w-full" />
  }

  if (!grants.data) {
    return null
  }

  const { offer } = grants.data

  if (offer.permissions.length === 0 && offer.roles.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        There is nothing to offer. This installation declares no permissions and no roles, which is not a thing that
        normally happens — the vocabulary is read from the policy documents, so an empty one means they did not load. A
        misconfiguration rather than a restriction.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border p-3">
      {/* ⚠️ This replaced a sentence saying the opposite — "an agent can never hold more than its owner"
          — which was true until the engine stopped intersecting a restricted agent with the account it
          acts for. A screen repeating a ceiling that no longer exists is worse than one saying nothing,
          because somebody grants on the strength of it. */}
      <p className="text-[11px] text-muted-foreground">
        <strong>A slave can outpower its master ⚡</strong>
        <br />
        Restricted means <em>its own</em> powers, not a weaker copy of its master's. Give it something you don't have —
        and yes, it can become the bigger boss. 😈
        <br />
        No safety net, no automatic rollback. The log remembers. 👀
      </p>

      <PermissionField offered={offer.permissions} chosen={permissions} onToggle={togglePermission} />

      <PlacementField offer={offer} placements={placements} onChange={setPlacements} />

      <div className="flex flex-wrap items-center gap-2">
        {dirty && <span className="text-[11px] text-muted-foreground">Unsaved — it applies from the agent's next call.</span>}

        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" disabled={!dirty || save.isPending} onClick={undo}>
            Undo
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ permissions, placements })}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * What it may do — one flat field of chips.
 *
 * Eighty-nine of them are seven rows, and seven rows of one thing beat five rows of chrome around a
 * window onto the same thing. The count in the heading is what says how many there are; nothing else
 * has to.
 */
function PermissionField({
  offered,
  chosen,
  onToggle,
}: {
  offered: string[]
  chosen: string[]
  onToggle: (permission: string) => void
}) {
  if (offered.length === 0) {
    return null
  }

  return (
    <section className="flex flex-col gap-1.5">
      <GrantsHeading title="What it may do" note={`${chosen.length} of ${offered.length} its owner can hand down`} />

      <div className="flex flex-wrap gap-1">
        {offered.map((permission) => (
          <ToggleChip
            key={permission}
            className="font-mono"
            active={chosen.includes(permission)}
            onClick={() => onToggle(permission)}
          >
            {chosen.includes(permission) ? "✓" : "+"} {permission}
          </ToggleChip>
        ))}
      </div>
    </section>
  )
}

/**
 * As what, and where.
 *
 * ⚠️ A place-scoped role cannot be added without a place, and an installation-wide one cannot be given
 * one. Both mistakes are refused here rather than corrected: one is a widening nobody asked for, the
 * other confers nothing where the person expected everything.
 */
function PlacementField({
  offer,
  placements,
  onChange,
}: {
  offer: AgentOffer
  placements: AgentPlacement[]
  onChange: (placements: AgentPlacement[]) => void
}) {
  const [roleName, setRoleName] = useState("")
  const [placeId, setPlaceId] = useState("")

  if (offer.roles.length === 0) {
    return null
  }

  const role = offer.roles.find((offered) => offered.name === roleName)
  const needsPlace = role?.placeScoped ?? false
  const complete = role !== undefined && (!needsPlace || placeId !== "")

  function add() {
    if (!complete) {
      return
    }

    const wanted: AgentPlacement = { roleName, placeId: needsPlace ? placeId : null }

    if (!placements.some((current) => describePlacement(current) === describePlacement(wanted))) {
      onChange([...placements, wanted])
    }

    setRoleName("")
    setPlaceId("")
  }

  return (
    <section className="flex flex-col gap-1.5">
      <GrantsHeading title="Where it acts, and as what" note={`${placements.length} placed`} />

      {placements.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {placements.map((placement) => (
            <span
              key={describePlacement(placement)}
              className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
            >
              <span aria-hidden="true">{placement.placeId === null ? "🌐" : "📍"}</span>
              <strong>{placement.roleName}</strong>
              <span className="text-muted-foreground">
                {placement.placeId === null ? "everywhere" : labelOf(offer, placement.placeId)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${placement.roleName}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange(placements.filter((current) => describePlacement(current) !== describePlacement(placement)))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <PlainSelect value={roleName} className="w-auto min-w-48" onChange={setRoleName}>
          <option value="">Add a role…</option>
          {offer.roles.map((offered) => (
            <option key={offered.name} value={offered.name}>
              {offered.name}
            </option>
          ))}
        </PlainSelect>

        {needsPlace && (
          <PlainSelect value={placeId} className="w-auto min-w-48" onChange={setPlaceId}>
            <option value="">…in which workspace?</option>
            {offer.places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
          </PlainSelect>
        )}

        <Button variant="ghost" size="sm" disabled={!complete} onClick={add}>
          + Add
        </Button>
      </div>

      {needsPlace && offer.places.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Its owner is not a member of anywhere this role would mean something, so there is nothing to place it in.
        </p>
      )}
    </section>
  )
}

function GrantsHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h4 className="text-xs font-semibold tracking-[0.04em] uppercase">{title}</h4>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </div>
  )
}

function labelOf(offer: AgentOffer, placeId: string): string {
  return offer.places.find((place) => place.id === placeId)?.label ?? placeId
}

/** ⚠️ A stable key for a pair, since a placement is compared by value and not by identity. */
function describePlacement(placement: AgentPlacement): string {
  return `${placement.roleName}@${placement.placeId ?? ""}`
}

/** ⚠️ Order-insensitive: a chip toggled off and back on must not read as a change. */
function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  const ordered = [...right].sort()

  return [...left].sort().every((entry, at) => entry === ordered[at])
}
