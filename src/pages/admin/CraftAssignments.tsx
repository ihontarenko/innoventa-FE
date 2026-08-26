import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@jmouse/ui"
import { adminApi } from "@/api/admin"
import { craftsApi, type Craft } from "@/api/crafts"

/** What a picker means by "nobody gave me one" — a value, because a Select cannot hold an empty string. */
const NONE = "none"

/**
 * Who holds which craft.
 *
 * <h2>⚠️ The half that was missing, and the reason a craft did nothing</h2>
 *
 * <p>The catalogue shipped, the ordering shipped, the endpoint shipped — and there was no way to give
 * anybody a craft, so nobody held one and the whole concept was inert. A feature reachable only through
 * `curl` is a feature that is not built.
 *
 * <h2>⚠️ It is a picker, never a grid of switches</h2>
 *
 * <p>One craft per person, chosen from a list, with **No craft** always available and never a warning.
 * A member with none is ordinary: they get the default order and everything their permissions allow.
 * Clearing one takes nothing away from anybody, which is why there is no confirmation here and must not
 * be one — a dialog asking *"are you sure?"* would teach an administrator that this is access control.
 */
export function CraftAssignments({ organizationId, crafts }: { organizationId: string; crafts: Craft[] }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")

  const people = useQuery({
    queryKey: ["admin", "users", "PERSON", search],
    queryFn: () => adminApi.listUsers(search, 0, 50, "PERSON").then((response) => response.data.content),
  })

  const held = useQuery({
    queryKey: ["crafts", organizationId, "held"],
    queryFn: () => craftsApi.held(organizationId).then((response) => response.data),
  })

  const heldByUser = useMemo(
    () => new Map((held.data ?? []).map((record) => [record.userId, record.craftId])),
    [held.data],
  )

  const assign = useMutation({
    mutationFn: ({ userId, craftId }: { userId: string; craftId: string | null }) =>
      craftsApi.assign(organizationId, userId, craftId),
    // ⚠️ Both lists, because the catalogue shows a count of who holds each one and it is wrong the
    // instant this succeeds.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crafts", organizationId, "held"] })
      void queryClient.invalidateQueries({ queryKey: ["crafts", organizationId] })
    },
  })

  if (crafts.length === 0) {
    return (
      <p className="text-muted-foreground text-[12.5px] leading-relaxed">
        Define a craft above first — there is nothing to give anybody yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find somebody"
          className="pl-9"
        />
      </div>

      {people.isPending ? (
        <Skeleton className="h-20" />
      ) : (people.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-[12.5px]">Nobody matches that.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(people.data ?? []).map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{person.displayName || person.email}</p>
                {person.displayName && (
                  <p className="text-muted-foreground truncate text-[11.5px]">{person.email}</p>
                )}
              </div>

              <Select
                value={heldByUser.get(person.id) ?? NONE}
                onValueChange={(value) =>
                  assign.mutate({ userId: person.id, craftId: value === NONE ? null : value })
                }
              >
                <SelectTrigger className="w-44 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* ⚠️ Always offered, and never phrased as a loss. */}
                  <SelectItem value={NONE}>No craft</SelectItem>
                  {crafts.map((craft) => (
                    <SelectItem key={craft.id} value={craft.id}>
                      {craft.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
