import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from "@jmouse/ui"
import { ToggleChip } from "@/components/ToggleChip"
import { useAgentOptions, useAgentsSwitch, useCreateAgent, useSwitchAllAgents } from "@/hooks/useAgents"
import { AgentsPanel } from "@/pages/admin/ai/AgentsPanel"
import { ConnectClientSection } from "./ConnectClientSection"

/**
 * Service accounts under your own.
 *
 * ⚠️ **The list below is the SAME component the administration screen renders**, over the self-scoped
 * routes. It used to be a bespoke table here and cards there, and the two disagreed about what an agent
 * even is. Everything below the header now comes from one file, so a change to what an agent means lands
 * in both products at once.
 */
export function AgentsTab() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        <div>
          <h2 className="text-sm font-medium">Agents</h2>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Service accounts under your own. An agent cannot sign in the way you do — no password, no magic link, no
            reset.
          </p>
        </div>

        <div className="ml-auto flex gap-2">
          {/* What an agent changed lives in your own activity, next to your sign-ins and anything an
              administrator did as you — one history rather than a modal beside it. */}
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings/activity")}>
            Activity
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            New agent
          </Button>
        </div>
      </div>

      {/* ⚠️ Above the list, because it is the answer to the question somebody arrives with. The list
          below is empty until a client has connected, and an empty list over instructions nobody can see
          is how a working feature reads as a broken one. */}
      <ConnectClientSection />

      <AllAgentsSwitch />

      <AgentsPanel surface="mine" heading={false} />

      {/* ⚠️ Kept, because this is the one thing the shared screen genuinely cannot offer. Creating an
          agent needs choices — which templates, which permissions, which workspaces — that a library
          with no notion of creating one in advance has no answer for. */}
      {creating && <CreateAgentDialog onClose={() => setCreating(false)} />}
    </div>
  )
}

/**
 * One switch over the lot, for shutting everything down without hunting through a list.
 *
 * ⚠️ Separate from each agent's own switch, and it says so: turning them all off and on again leaves the
 * one you switched off individually still off.
 */
function AllAgentsSwitch() {
  const { data } = useAgentsSwitch()
  const switchAll = useSwitchAllAgents()

  if (!data || data.agentCount === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
      <Switch
        checked={data.agentsEnabled}
        disabled={switchAll.isPending}
        onCheckedChange={(enabled) => switchAll.mutate(enabled)}
      />
      <span className="text-sm">{data.agentsEnabled ? "Agents may act" : "Every agent is stopped"}</span>
      <span className="text-xs text-muted-foreground">
        Covers all {data.agentCount} of them. Each keeps its own setting for when this goes back on.
      </span>
    </div>
  )
}

function CreateAgentDialog({ onClose }: { onClose: () => void }) {
  const { data: options } = useAgentOptions()
  const createAgent = useCreateAgent()

  const [name, setName] = useState("")
  const [roleNames, setRoleNames] = useState<string[]>([])
  const [spaceIds, setSpaceIds] = useState<string[]>([])

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((chosen) => chosen !== value) : [...list, value])
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
          <DialogDescription>
            It starts able to act. What it holds is edited on its own card, once it exists.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Name</span>
          <Input
            autoFocus
            className="h-8 text-sm"
            value={name}
            placeholder="What it is for — a person reads this on every by-line it leaves"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {(options?.roleTemplates ?? []).length > 0 && (
            <section className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Roles</span>
              <div className="flex flex-wrap gap-1">
                {(options?.roleTemplates ?? []).map((template) => (
                  <ToggleChip
                    key={template.name}
                    title={template.description ?? undefined}
                    active={roleNames.includes(template.name)}
                    onClick={() => toggle(roleNames, template.name, setRoleNames)}
                  >
                    {template.label || template.name}
                  </ToggleChip>
                ))}
              </div>
            </section>
          )}

          {(options?.availableSpaces ?? []).length > 0 && (
            <section className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium">Workspaces</span>
              <div className="flex flex-wrap gap-1">
                {(options?.availableSpaces ?? []).map((space) => (
                  <ToggleChip
                    key={space.id}
                    active={spaceIds.includes(space.id)}
                    onClick={() => toggle(spaceIds, space.id, setSpaceIds)}
                  >
                    {space.name}
                  </ToggleChip>
                ))}
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={createAgent.isPending || name.trim().length === 0}
            onClick={() =>
              createAgent.mutate(
                { name: name.trim(), roleNames, spaceIds },
                {
                  onSuccess: () => {
                    toast.success(`${name.trim()} created.`)
                    onClose()
                  },
                  onError: () => toast.error("Could not create the agent."),
                },
              )
            }
          >
            Create agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
