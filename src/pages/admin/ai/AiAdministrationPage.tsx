import { useState } from "react"
import { Badge, Tabs, TabsList, TabsTrigger, cn } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { Callout } from "@/components/Callout"
import { PageHeader } from "@/components/PageHeader"
import { useAiOverview } from "@/hooks/useAiAdministration"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const AI = platformItem("ai")
import type { AiOverview } from "@/api/ai"
import { ActivityPanel } from "./ActivityPanel"
import { AgentsPanel } from "./AgentsPanel"
import { CataloguePanel } from "./CataloguePanel"
import { PromptPanel } from "./PromptPanel"
import { ProviderPanel } from "./ProviderPanel"

type Panel = "provider" | "prompt" | "catalogue" | "agents" | "activity"

/** Which panels a link may open directly — see the fragment note on the state below. */
const OPENABLE_PANELS: Panel[] = ["provider", "prompt", "catalogue", "agents", "activity"]

/**
 * The machinery behind the assistant and the protocol endpoint, on one screen.
 *
 * ⚠️ **The assistant needs no environment variable.** The provider, the model, the token ceiling and the
 * key are rows, so switching the assistant on is a form somebody fills in — not a file, a deploy and a
 * secret handed to whoever does deploys.
 *
 * ⚠️ **Two permissions, not one.** Everything that reads is behind `ai:read`; the configuration is
 * behind `ai:administer`, which decides what this installation sends somebody else's servers and holds
 * the key it pays with.
 *
 * ⚠️ **Nothing here knows the product's name** — these panels talk to `jmouse-ai-management` over its
 * own prefix, and the shape is the library's. That is what will let them move out later without being
 * rewritten (`INVT-0049`).
 */
export function AiAdministrationPage() {
  // The door is the declaration's to answer — installation-wide, because the catalogue and the counters
  // belong to the installation rather than to any workspace, and that is said once in `navigation.ts`.
  const mayOpen = useAuthStore((state) => state.holds)
  const mayRead = mayOpen(AI)

  // ⚠️ **A WRITE gate, and it is right that it is typed here.** `ai:administer` leads to no menu row and
  // has no declaration to ask; the one-declaration rule is about a destination's *door*, not about every
  // control behind it. Reaching for `platformItem` here would invent an entry for a screen that is
  // already on the Administration screen once.
  const mayAdminister = useAuthStore((state) => state.holdsEverywhere)("ai:administer")

  /**
   * ⚠️ **The opening panel comes from the fragment, so a link can land on one.** A client's detail on
   * the account screen sends people here for what it deliberately does not edit — authority, grants,
   * tools — and a link that dropped them on Provider instead would make them hunt for the tab. Local
   * state after that: which panel somebody is reading is not worth a history entry.
   */
  const [panel, setPanel] = useState<Panel>(() => {
    const requested = window.location.hash.replace("#", "")

    return OPENABLE_PANELS.includes(requested as Panel) ? (requested as Panel) : "provider"
  })

  const overview = useAiOverview()

  if (!mayRead) {
    return (
      <AccessDenied
        title="AI"
        why="This screen discloses what every caller has asked the tools to do, which is its own power."
        permissions={requiredPermissionsOf(AI)}
      />
    )
  }

  return (
    <>
      <PageHeader title="AI" description="The assistant, the tools it holds, and what they have cost" />

      <Tabs value={panel} onValueChange={(next) => setPanel(next as Panel)} className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="provider">Provider</TabsTrigger>
          {/* Beside the provider rather than at the end: which model answers and what it is told are the
              two halves of one question, and somebody who has just switched a provider on is one tab
              away from the thing that decides how it behaves. */}
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="catalogue">
            Actions
            <Badge variant="secondary" className="ml-1.5 font-mono text-[10px]">
              {overview.data?.publishedActions ?? "—"}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {overview.data && <InForce overview={overview.data} />}

          {panel === "provider" && <ProviderPanel mayAdminister={mayAdminister} />}
          {panel === "prompt" && <PromptPanel mayAdminister={mayAdminister} />}
          {panel === "catalogue" && <CataloguePanel />}
          {panel === "agents" && <AgentsPanel />}
          {panel === "activity" && <ActivityPanel trailRecorded={overview.data?.trailRecorded ?? true} />}
        </div>
      </Tabs>
    </>
  )
}

/**
 * What is actually in force, above every tab.
 *
 * ⚠️ **Not the same question as which row is ticked.** This is what the settings source returned when it
 * was asked — so it is empty when nothing is active, empty again when two rows are and the library
 * refuses to choose between them, and present-but-unusable when the configuration has no key. Each of
 * those is a different sentence, because each has a different fix.
 */
function InForce({ overview }: { overview: AiOverview }) {
  const provider = overview.activeProvider

  if (!provider) {
    return (
      <Callout tone="info">
        <span>
          <strong>No provider is in force.</strong> The assistant is off and says so; the tools themselves are
          unaffected — a connected client still reaches every one of them. Add a configuration below and activate it.
        </span>
      </Callout>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", overview.assistantAvailable ? "bg-success" : "bg-muted-foreground")}
      />

      <div className="flex min-w-0 flex-col">
        <span className="text-sm">
          <strong>
            {provider.providerName} / {provider.model}
          </strong>
          <span className="text-muted-foreground">
            {" · "}up to {provider.maximumTokens} tokens per answer
            {provider.apiUrl ? ` · ${provider.apiUrl}` : ""}
          </span>
        </span>

        {!provider.usable && (
          <span className="text-xs text-warning">
            No key is set on it, so every call would be refused before it was sent. Edit the configuration and give it
            one.
          </span>
        )}
      </div>

      <span className="ml-auto text-xs text-muted-foreground">
        {overview.assistantAvailable ? "Assistant answering" : "Assistant off"}
      </span>
    </div>
  )
}
