import { useMemo, useState } from "react"
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import type { AccessHolderView } from "@/api/access"
import { useAccessWhat } from "@/hooks/useAccess"
import { useAdminPermissions } from "@/hooks/useAdministration"
import { EmptyAnswer } from "./WhoPanel"

/**
 * A permission, and everybody who holds it.
 *
 * The question behind it is *who can delete a workspace*, and before this screen it had no answer short
 * of a SQL session.
 *
 * ⚠️ **A catalogue rather than a text box.** A permission is a constant in the application, so a name
 * one character out does not fail — it answers **nobody**, which is the worst possible wrong answer on a
 * screen whose whole subject is who holds what. The picker groups by namespace because seventy flat
 * options is a list nobody reads to the end of.
 */
export function WhatPanel() {
  const [permission, setPermission] = useState("")

  const { data: catalogue = [] } = useAdminPermissions()
  const { data, isLoading } = useAccessWhat(permission || undefined)

  const namespaces = useMemo(() => groupByNamespace(catalogue), [catalogue])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Permission"
          className="h-9 min-w-72 rounded-md border bg-transparent px-2 font-mono text-sm shadow-xs"
          value={permission}
          onChange={(event) => setPermission(event.target.value)}
        >
          <option value="">Pick a permission…</option>
          {[...namespaces].map(([namespace, names]) => (
            <optgroup key={namespace} label={namespace}>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Badge variant="outline">{catalogue.length} declared</Badge>
      </div>

      {!permission ? (
        <EmptyAnswer
          glyph="⌕"
          title="Pick a permission"
          message="This answers who holds it, and by which route — a role, a personal allow, a personal deny."
        />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data ? null : (
        <>
          {data.throughRoles.map((group) => (
            <section key={group.roleName} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">
                {group.roleName} → {group.conferredAt?.label ?? ""}
              </h3>
              <HolderTable holders={group.holders} />
            </section>
          ))}

          {data.throughPersonalAllows.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">Personal allow</h3>
              <HolderTable holders={data.throughPersonalAllows} />
            </section>
          )}

          {data.throughPersonalDenies.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-[0.04em] uppercase">
                Personal deny — these people have had it taken away
              </h3>
              <HolderTable holders={data.throughPersonalDenies} />
            </section>
          )}

          {data.throughRoles.length === 0 &&
            data.throughPersonalAllows.length === 0 &&
            data.throughPersonalDenies.length === 0 && (
              <EmptyAnswer
                glyph="∅"
                title="Nobody"
                message={`No role bundles ${data.permission} and nobody holds it personally.`}
              />
            )}
        </>
      )}
    </div>
  )
}

/** The catalogue as `namespace → its permissions`, both sorted, for one grouped picker. */
function groupByNamespace(permissions: string[]): Map<string, string[]> {
  const byNamespace = new Map<string, string[]>()

  for (const permission of [...permissions].sort()) {
    const namespace = permission.split(":")[0]

    byNamespace.set(namespace, [...(byNamespace.get(namespace) ?? []), permission])
  }

  return byNamespace
}

function HolderTable({ holders }: { holders: AccessHolderView[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>At</TableHead>
            <TableHead>Given by</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Since</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holders.map((holder) => (
            <TableRow key={`${holder.userId}-${holder.scope?.label}`}>
              <TableCell>{holder.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{holder.scope?.label}</Badge>
              </TableCell>
              <TableCell>{holder.grantedBy ?? "—"}</TableCell>
              <TableCell className="max-w-64 truncate">{holder.reason ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{holder.since?.slice(0, 10) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
