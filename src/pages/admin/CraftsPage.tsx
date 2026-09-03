import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { craftsApi, type Craft } from "@/api/crafts"
import { CraftAssignments } from "@/pages/admin/CraftAssignments"
import { useReachableContext } from "@/hooks/useSpaces"
import { spaceSettingsApi } from "@/api/spaces"
import { stations } from "@/stations"

/**
 * An organisation's crafts — the catalogue, and what each one puts first.
 *
 * <h2>⚠️ This screen must not read like a permissions screen</h2>
 *
 * <p>It is the one surface where the concept gets misunderstood, and once an administrator believes a
 * craft grants something, everything downstream is wrong. So, deliberately:
 *
 * <ul>
 *   <li><strong>It is not beside roles or access.</strong> Its own address, its own place.
 *   <li><strong>It says what it does, on the screen.</strong> One sentence at the top, not a tooltip
 *       nobody opens.
 *   <li><strong>There are no allow/deny controls of any kind.</strong> No checkboxes that look like
 *       permissions, no module toggles. The moment this shows a grid of things that can be switched
 *       off, it has become a role editor and somebody will use it as one — which is why the only list
 *       here is an <em>order</em>, and why removing something from it hides nothing.
 *   <li><strong>Nothing here is ever the reason something is unavailable.</strong> If a screen is
 *       refused it is a permission, and saying otherwise sends somebody to an administrator who cannot
 *       help them.
 * </ul>
 */
export function CraftsPage() {
  const context = useReachableContext()
  const organizationId = context.data?.organizations[0]?.id ?? null

  /**
   * ⚠️ Read from ONE workspace, the account's first, because a craft is organisation-wide while a
   * component type belongs to a workspace. The seeded types share their identifiers across workspaces,
   * so this offers a usable list rather than a complete one — and a key that matches nothing anywhere
   * is inert, which is why an imperfect list is safe here.
   */
  const componentTypes = useQuery({
    queryKey: ["crafts", "component-types", organizationId],
    queryFn: () =>
      spaceSettingsApi
        /* ⚠️ `CATALOG` — the kinds of component, not the one schema a position is recorded with. This
           read `INVENTORY` until the two purposes swapped roles, after which it offered a craft
           exactly one choice: "Inventory", the storage schema. The string looks the same for both
           ideas, so it has to be said out loud which one is meant. */
        .formsPaged(context.data!.organizations[0]!.spaceIds[0]!, 0, 500, "CATALOG")
        .then((response) => response.data.content.map((form) => ({ id: form.id, name: form.name }))),
    enabled: Boolean((context.data?.organizations[0]?.spaceIds.length ?? 0) > 0),
  })

  const crafts = useQuery({
    queryKey: ["crafts", organizationId],
    queryFn: () => craftsApi.list(organizationId!).then((response) => response.data),
    enabled: Boolean(organizationId),
  })

  return (
    <>
      <PageHeader
        title="Crafts"
        description="What people here do — which decides what they are shown first, and never what they may open"
      />

      {!organizationId ? (
        <p className="text-muted-foreground text-[12.5px]">
          {context.isPending ? "…" : "You are not in an account that can define crafts."}
        </p>
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          <Alert>
            <AlertDescription className="text-[12.5px] leading-relaxed">
              A craft is a job, not a permission. It decides which station somebody is offered first and
              in what order — it can never give anybody access to anything, and removing one takes
              nothing away. What people <em>may</em> do is roles and access control.
            </AlertDescription>
          </Alert>

          {crafts.isPending ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <CraftCatalogue
                organizationId={organizationId}
                crafts={crafts.data ?? []}
                componentTypes={componentTypes.data ?? []}
              />

              <div className="flex flex-col gap-2 pt-2">
                <h2 className="text-[13.5px] font-medium">Who holds which</h2>
                <CraftAssignments organizationId={organizationId} crafts={crafts.data ?? []} />
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

function CraftCatalogue({
  organizationId,
  crafts,
  componentTypes,
}: {
  organizationId: string
  crafts: Craft[]
  componentTypes: { id: string; name: string }[]
}) {
  const queryClient = useQueryClient()
  const [draftName, setDraftName] = useState("")

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["crafts", organizationId] })

  const create = useMutation({
    mutationFn: (name: string) =>
      craftsApi.create(organizationId, {
        // ⚠️ Derived once, at creation, and never again. Renaming a craft must not detach everybody
        // holding it, and it would if the key travelled with the name.
        key: keyFrom(name),
        name,
        sortOrder: crafts.length,
        preferredKeys: [],
      }),
    onSuccess: () => {
      setDraftName("")
      void invalidate()
    },
  })

  const update = useMutation({
    mutationFn: ({ craft, preferredKeys }: { craft: Craft; preferredKeys: string[] }) =>
      craftsApi.update(organizationId, craft.id, {
        key: craft.key,
        name: craft.name,
        description: craft.description,
        icon: craft.icon,
        sortOrder: craft.sortOrder,
        preferredKeys,
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (craftId: string) => craftsApi.remove(organizationId, craftId),
    onSuccess: invalidate,
  })

  return (
    <div className="flex flex-col gap-3">
      {crafts.map((craft) => (
        <Card key={craft.id}>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">{craft.name}</p>
                <p className="text-muted-foreground text-[11.5px]">
                  {craft.memberCount === 0
                    ? "Nobody holds this"
                    : craft.memberCount === 1
                      ? "One person holds this"
                      : `${craft.memberCount} people hold this`}
                </p>
              </div>
              {/* ⚠️ No confirmation dialog and no "in use" refusal. Removing a craft detaches whoever
                  held it and takes nothing away — a member with no craft is ordinary. A warning here
                  would teach an administrator that a craft is something people depend on. */}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${craft.name}`}
                onClick={() => remove.mutate(craft.id)}
              >
                <Trash2 />
              </Button>
            </div>

            <StationOrder
              craft={craft}
              componentTypes={componentTypes}
              onChange={(preferredKeys) => update.mutate({ craft, preferredKeys })}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="craft-name" className="text-[11.5px]">
            Add a craft
          </Label>
          <Input
            id="craft-name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Warehouse keeper"
          />
        </div>
        <Button disabled={!draftName.trim() || create.isPending} onClick={() => create.mutate(draftName.trim())}>
          <Plus />
          Add
        </Button>
      </div>
    </div>
  )
}

/**
 * Which station this craft puts first.
 *
 * ⚠️ **An ORDER, and there is no "off".** Every station a person may open stays available whatever is
 * chosen here — this only decides which one is suggested. That is why the control is a single picker
 * rather than a list of switches: a switch is the shape that says "this one is not for you".
 */
function StationOrder({
  craft,
  componentTypes,
  onChange,
}: {
  craft: Craft
  componentTypes: { id: string; name: string }[]
  onChange: (preferredKeys: string[]) => void
}) {
  const first = craft.preferredKeys[0] ?? ""
  /**
   * ⚠️ **Stations and component types in one list, because `preferredKeys` is deliberately untyped.**
   * A craft says what somebody opens first; whether that is a station or a kind of component is not a
   * distinction the person choosing cares about, and each consumer matches only the keys it recognises.
   * A key naming something a workspace does not have matches nothing — the failure mode this whole
   * shape was built to have.
   */
  const options = useMemo(
    () => [
      ...stations.map((station) => ({ key: station.key, name: station.name })),
      ...componentTypes.map((type) => ({ key: type.id, name: type.name })),
    ],
    [componentTypes],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11.5px]">Opens first</Label>
      <Select value={first || "none"} onValueChange={(value) => onChange(value === "none" ? [] : [value])}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No preference</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Suggested first on the Stations shelf. Everything else stays exactly as available as it was.
      </p>
    </div>
  )
}

/**
 * ⚠️ **The key is derived from the name once and is then permanent.** It is what an ordering
 * preference records, so if it followed the name every rename would silently detach everybody holding
 * the craft.
 */
function keyFrom(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  // A name written entirely in Cyrillic slugifies to nothing, and an empty key is refused by the
  // backend — so it falls back to something stable rather than to an error the person cannot act on.
  return slug || `craft-${Date.now().toString(36)}`
}
