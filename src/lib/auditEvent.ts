import type { AuditEventView, AuditOutcome } from "@/api/audit"

/**
 * How a recorded constant reads to a person.
 *
 * `MISSING_PERMISSION` → `missing permission`, which is what anyone reads it as anyway. Shared by the
 * system-wide log, an account's own activity and the agent overview, so the same outcome can never end
 * up worded three ways across three screens somebody is comparing.
 */
export function humanizeAuditValue(value: string): string {
  return value.split("_").join(" ").toLowerCase()
}

/** The only scope kind that exists today, and the reason the kind is normally left unsaid. */
const SPACE_SCOPE = "SPACE"

/**
 * What kind of thing a scope is, when saying so tells the reader anything.
 *
 * ⚠️ Every scope is a space right now, and a column repeating "space" on every row is noise. The audit
 * store is a module that knows nothing about workspaces, though, so a second kind can appear without a
 * migration — and on the day it does the label alone stops being enough. Naming the kind only when it is
 * unexpected is what lets that day arrive quietly.
 */
export function auditScopeKind(scopeType: string | null): string | null {
  if (!scopeType || scopeType === SPACE_SCOPE) {
    return null
  }

  return humanizeAuditValue(scopeType)
}

/** How alarming an ending should look: done is calm, refused and failed are not, the rest is neutral. */
export function outcomeVariant(outcome: AuditOutcome | string): "default" | "destructive" | "secondary" {
  if (outcome === "CARRIED_OUT") {
    return "default"
  }

  if (outcome === "REFUSED" || outcome === "FAILED") {
    return "destructive"
  }

  return "secondary"
}

/**
 * How an event's two actor slots read as one description.
 *
 * Shared by the table and the drawer so the two can never disagree about who did something — an agent's
 * row and its drawer naming different people would be worse than either being wrong alone.
 *
 * ⚠️ The distinction the wording carries: an agent acts **for** its master, an administrator acts **as**
 * the account they borrowed. A borrowed identity must never read as the person themselves.
 */
export interface ActorDescription {
  /** Who physically acted, or null when nobody was signed in. */
  actor: string | null
  /** Whose authority was in play, when that is somebody else. */
  onBehalfOf: string | null
  /** The word joining the two: "for" an agent's master, "as" a borrowed account. */
  relation: "for" | "as" | null
}

export function describeActor(event: AuditEventView): ActorDescription {
  if (event.actorType === "ANONYMOUS") {
    return { actor: null, onBehalfOf: null, relation: null }
  }

  if (event.actorType === "SYSTEM") {
    return { actor: "System", onBehalfOf: null, relation: null }
  }

  const actor = event.actorName ?? event.actorId

  if (event.onBehalfOfId === null || event.onBehalfOfId === event.actorId) {
    return { actor, onBehalfOf: null, relation: null }
  }

  return {
    actor,
    onBehalfOf: event.onBehalfOfName ?? event.onBehalfOfId,
    relation: event.actorType === "IMPERSONATION" ? "as" : "for",
  }
}

/** The same description as one line, for places with no room to lay it out. */
export function describeActorInline(event: AuditEventView): string {
  const description = describeActor(event)

  if (description.actor === null) {
    return "Anonymous"
  }

  if (description.onBehalfOf === null) {
    return description.actor
  }

  const relation = description.relation === "as" ? "acting as" : "on behalf of"

  return `${description.actor} — ${relation} ${description.onBehalfOf}`
}
