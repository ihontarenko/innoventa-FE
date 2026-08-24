import { useState } from "react"
import { Badge, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import { usePublishedActions } from "@/hooks/useAiAdministration"

/**
 * Every action the mechanism publishes — to a connected client and to the assistant alike.
 *
 * **One catalogue and not two, which is what the whole extraction was for.** This is the screen where
 * somebody can see that it is actually true: the protocol endpoint and the in-app assistant are looking
 * at this list and no other.
 *
 * The three flags are what a reader scans for — whether it only looks, whether it can destroy, and
 * whether it is pinned to one workspace — and the permission column is the answer to "why can this agent
 * not do that", which is the question people actually arrive with.
 */
export function CataloguePanel() {
  const actions = usePublishedActions()
  const [filter, setFilter] = useState("")
  const [opened, setOpened] = useState<string | null>(null)

  if (actions.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  const needle = filter.trim().toLowerCase()
  const visible = (actions.data ?? []).filter(
    (action) =>
      needle.length === 0 ||
      action.publishedName.toLowerCase().includes(needle) ||
      action.title.toLowerCase().includes(needle) ||
      action.requiredPermission.toLowerCase().includes(needle),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Published actions</h2>
        <Input
          className="ml-auto h-8 w-72 text-sm"
          value={filter}
          placeholder="Filter by name, title or permission…"
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
          <span className="text-sm font-medium">Nothing matches</span>
          <span className="text-xs text-muted-foreground">
            No published action has that in its name, title or permission.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Action</TableHead>
                <TableHead>What it does</TableHead>
                <TableHead className="w-56">Costs</TableHead>
                <TableHead className="w-56">Nature</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((action) => (
                <TableRow
                  key={action.publishedName}
                  className="cursor-pointer"
                  onClick={() => setOpened(opened === action.publishedName ? null : action.publishedName)}
                >
                  <TableCell className="align-top font-mono text-xs">
                    {action.publishedName}
                    <div className="text-[11px] text-muted-foreground">{action.qualifiedName}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm">{action.title}</div>
                    {opened === action.publishedName && (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px]">
                          {JSON.stringify(action.inputSchema, null, 2)}
                        </pre>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs">{action.requiredPermission}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {action.readOnly && <Badge variant="secondary">reads</Badge>}
                      {!action.readOnly && !action.destructive && <Badge>writes</Badge>}
                      {action.destructive && <Badge variant="destructive">destroys</Badge>}
                      {action.scopeConfined && <Badge variant="outline">one workspace</Badge>}
                      {/* Forwarded to a server this installation connected to rather than answered here
                          — worth showing, because "why did that fail" has a different answer for each. */}
                      {action.origin === "REMOTE" && <Badge variant="outline">remote</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
