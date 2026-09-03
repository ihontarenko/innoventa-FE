import { useState, type FormEvent } from "react"
import { Badge, Button, Input, NativeSelect, Skeleton, cn } from "@jmouse/ui"
import { useAccessSimulation } from "@/hooks/useAccess"
import { useAdminPermissions, useAdminUsers } from "@/hooks/useAdministration"
import { useSpaces } from "@/hooks/useSpaces"
import { EmptyAnswer } from "./WhoPanel"
import { SourceLine } from "./SourceLine"

/**
 * Subject, permission and target → the real decision, with the axis that answered.
 *
 * ⚠️ **It runs the decision FOR REAL**, on the same read path a request would have taken. A simulation
 * that runs different code from what it simulates is a simulation of something else — the failure mode
 * of every "test this rule" screen that has ever quietly disagreed with production.
 */
export function SimulatePanel() {
  const [userId, setUserId] = useState("")
  const [permission, setPermission] = useState("")
  const [spaceId, setSpaceId] = useState("")
  const [isRunning, setRunning] = useState(false)

  const { data: users } = useAdminUsers(undefined, 0, 100)
  const { data: spaces } = useSpaces()
  const { data: catalogue = [] } = useAdminPermissions()

  const { data, isLoading } = useAccessSimulation(
    { userId, permission, spaceId: spaceId || undefined },
    isRunning,
  )

  // ⚠️ Any change un-runs it. An answer sitting under changed inputs is the one thing a simulation must
  // never show — somebody would read a verdict for a question they are no longer asking.
  function change(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setRunning(false)
    }
  }

  function run(event: FormEvent) {
    event.preventDefault()
    setRunning(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-center gap-2" onSubmit={run}>
        <NativeSelect
          aria-label="Subject"
          className="min-w-56"
          value={userId}
          onChange={(event) => change(setUserId)(event.target.value)}
        >
          <option value="">Pick a subject…</option>
          {users?.content?.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName || person.email}
            </option>
          ))}
        </NativeSelect>

        {/* A datalist rather than a plain box: the catalogue is what exists, and a typo answers
            "refused" for a permission that was never asked about. */}
        <Input
          className="w-56 font-mono text-sm"
          list="simulate-permissions"
          placeholder="entry:write"
          value={permission}
          onChange={(event) => change(setPermission)(event.target.value)}
        />
        <datalist id="simulate-permissions">
          {catalogue.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <NativeSelect
          aria-label="Where"
          className="min-w-48"
          value={spaceId}
          onChange={(event) => change(setSpaceId)(event.target.value)}
        >
          <option value="">No workspace</option>
          {spaces?.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </NativeSelect>

        <Button type="submit" disabled={!userId || !permission}>
          Decide
        </Button>
      </form>

      {!isRunning ? (
        <EmptyAnswer
          glyph="⚖"
          title="Ask the engine"
          message="Subject, permission and target. It runs the real decision and names which of the five axes answered."
        />
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data ? null : (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-md border p-4",
            data.decision.granted ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.decision.granted ? "default" : "destructive"}>
              {data.decision.granted ? "Allowed" : `Refused · ${data.decision.axis}`}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{data.target}</span>
          </div>

          {!data.decision.granted && (
            <>
              <div className="text-sm font-medium">{data.decision.title}</div>
              {/* The axis's own words, never a shared "access denied" — a reader told the same sentence
                  by two axes concludes the product is broken. */}
              <p className="text-sm text-muted-foreground">{data.decision.words}</p>
            </>
          )}

          {data.provenance && (
            <div className="flex flex-col gap-1 border-t pt-2">
              {data.provenance.grantedBy.map((source, index) => (
                <SourceLine key={`granted-${index}`} source={source} removed={false} />
              ))}
              {data.provenance.removedBy.map((source, index) => (
                <SourceLine key={`removed-${index}`} source={source} removed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
