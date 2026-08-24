import { Badge, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@jmouse/ui"
import type { PolicyReadingSource } from "@/api/policy"
import { usePolicyReading } from "@/hooks/usePolicyWorkbench"
import type { PolicyWorkbench } from "@/hooks/usePolicyWorkbench"
import { PolicyCodePane } from "./PolicyCodePane"

/**
 * One reading of the installation's authorization, rendered as `.jmp` and **read-only**.
 *
 * ⚠️ **Three readings rather than one merged blob**, because a single one loses the question the
 * editor exists to answer: *which of these may I change*. `policy` is what the files declare,
 * `database` is what the tables hold projected into the same notation, and `effective` is the
 * composite the engine resolves from.
 */
export function PolicyResolvedPane() {
  return (
    <Tabs defaultValue="effective">
      <TabsList>
        <TabsTrigger value="effective">Effective</TabsTrigger>
        <TabsTrigger value="database">Database</TabsTrigger>
        <TabsTrigger value="policy">Policy files</TabsTrigger>
      </TabsList>

      {(["effective", "database", "policy"] as PolicyReadingSource[]).map((source) => (
        <TabsContent key={source} value={source}>
          <Reading source={source} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function Reading({ source }: { source: PolicyReadingSource }) {
  const { data, isLoading } = usePolicyReading(source, true)

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!data) {
    return <p className="text-xs text-muted-foreground">This reading did not load.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{data.roles} roles</Badge>
        <Badge variant="outline">{data.subjects} subjects</Badge>
        {/* ⚠️ `derived` says the text was RENDERED rather than written: a projection carries no
            `include`, no comments and no formatting anybody chose, because none of that was ever in a
            table. Whatever shows it has to say so, or the first person to copy it into a file wonders
            where their comments went. */}
        {data.derived && <Badge variant="secondary">rendered from rows — comments and includes are not in it</Badge>}
      </div>

      <PolicyCodePane source={data.text} readOnly />
    </div>
  )
}

/**
 * What came with the application.
 *
 * ⚠️ **Read-only for everybody, including whoever may write policy.** These files were written into the
 * tables once at first start; the rows they seeded are editable, the files are not — and a screen that
 * offered to edit them would be offering a change that silently never happens.
 */
export function PolicyShippedPane({ workbench }: { workbench: PolicyWorkbench }) {
  if (workbench.shipped.length === 0) {
    return <p className="text-xs text-muted-foreground">Nothing shipped with this installation.</p>
  }

  return (
    <Tabs defaultValue={workbench.shipped[0].name}>
      <TabsList>
        {workbench.shipped.map((file) => (
          <TabsTrigger key={file.name} value={file.name} className="font-mono text-xs">
            {file.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {workbench.shipped.map((file) => (
        <TabsContent key={file.name} value={file.name} className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{file.why}</p>
          <PolicyCodePane source={file.text} readOnly />
        </TabsContent>
      ))}
    </Tabs>
  )
}
