import { useState } from "react"
import {
  Badge,
  Button,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import {
  useActivateProviderConfiguration,
  useCreateProviderConfiguration,
  useDeactivateProviderConfiguration,
  useDeleteProviderConfiguration,
  useProviderConfigurations,
  useUpdateProviderConfiguration,
} from "@/hooks/useAiAdministration"
import type { ProviderConfiguration, SupportedProvider } from "@/api/ai"
import { NotAdministering } from "./NotAdministering"

/**
 * Which model this installation talks to, on whose key.
 *
 * **This is the screen that replaced an environment variable.** The rows live in a table, so rotating a
 * key is a form rather than a deploy, and the person who does it holds `ai:administer` rather than access
 * to the server's environment.
 *
 * ⚠️ **The key is write-only, everywhere.** No response carries one, so an existing configuration shows
 * "key set" and an empty box. Leaving that box empty on a save means *keep the stored key* — the only
 * behaviour that lets somebody correct a model name without silently erasing the credential.
 */
export function ProviderPanel({ mayAdminister }: { mayAdminister: boolean }) {
  const configurations = useProviderConfigurations()
  const activate = useActivateProviderConfiguration()
  const deactivate = useDeactivateProviderConfiguration()
  const remove = useDeleteProviderConfiguration()

  const [editing, setEditing] = useState<ProviderConfiguration | "new" | null>(null)

  if (!mayAdminister) {
    return (
      <NotAdministering>
        Choosing the provider decides what this installation sends somebody else's servers and holds the key it pays
        with, so it is its own permission.
      </NotAdministering>
    )
  }

  if (configurations.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  const rows = configurations.data?.configurations ?? []
  const providers = configurations.data?.providers ?? []
  const busy = activate.isPending || deactivate.isPending || remove.isPending

  // Asked of the provider rather than assumed of every configuration: a model on this machine has no
  // credential to give, and greying out "Put in force" for it would make the only free option the one
  // nobody can switch on.
  const needsKey = (name: string) => providers.find((shipped) => shipped.name === name)?.requiresKey ?? true

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold tracking-[0.04em] uppercase">Provider configurations</h2>
        {editing === null && (
          <Button size="sm" className="ml-auto" onClick={() => setEditing("new")}>
            Add a configuration
          </Button>
        )}
      </div>

      {editing !== null && (
        <ProviderForm
          configuration={editing === "new" ? null : editing}
          providers={providers}
          onClose={() => setEditing(null)}
        />
      )}

      {rows.length === 0 && editing === null ? (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
          <span aria-hidden="true" className="text-2xl">
            ◍
          </span>
          <span className="text-sm font-medium">Nothing is configured</span>
          <span className="max-w-md text-xs text-muted-foreground">
            Add a provider, give it a key, and activate it. Until then the assistant is off and the protocol endpoint
            carries on exactly as it is.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-24">Ceiling</TableHead>
                <TableHead className="w-28">Key</TableHead>
                <TableHead className="w-28">State</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((configuration) => {
                const keyReady = configuration.keyConfigured || !needsKey(configuration.provider)

                return (
                  <TableRow key={configuration.id}>
                    <TableCell className="font-mono text-xs">{configuration.provider}</TableCell>
                    <TableCell>
                      <div className="text-sm">{configuration.model}</div>
                      {configuration.apiUrl && (
                        <div className="max-w-72 truncate text-[11px] text-muted-foreground" title={configuration.apiUrl}>
                          {configuration.apiUrl}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{configuration.maximumTokens}</TableCell>
                    <TableCell>
                      <span className={cn("text-xs", keyReady ? "text-success" : "text-destructive")}>
                        {configuration.keyConfigured ? "set" : needsKey(configuration.provider) ? "missing" : "not needed"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={configuration.active ? "default" : "outline"}>
                        {configuration.active ? "In force" : "Idle"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(configuration)}>
                          Edit
                        </Button>

                        {configuration.active ? (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => deactivate.mutate(configuration.id)}>
                            Take out of force
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || !keyReady}
                            title={
                              keyReady
                                ? undefined
                                : "Give it a key first — every call through it would be refused before it was sent."
                            }
                            onClick={() => activate.mutate(configuration.id)}
                          >
                            Put in force
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={busy || configuration.active}
                          title={configuration.active ? "This is the one in force. Take it out of force first." : undefined}
                          onClick={() => remove.mutate(configuration.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ProviderForm({
  configuration,
  providers,
  onClose,
}: {
  /** Null for a new one — which is created idle, because typing a key is not saying "start spending". */
  configuration: ProviderConfiguration | null
  providers: SupportedProvider[]
  onClose: () => void
}) {
  const create = useCreateProviderConfiguration()
  const update = useUpdateProviderConfiguration()

  const [provider, setProvider] = useState(configuration?.provider ?? providers[0]?.name ?? "")
  const [model, setModel] = useState(configuration?.model ?? "")
  const [apiKey, setApiKey] = useState("")
  const [apiUrl, setApiUrl] = useState(configuration?.apiUrl ?? "")
  const [maximumTokens, setMaximumTokens] = useState(configuration?.maximumTokens ?? 4096)

  const chosen = providers.find((shipped) => shipped.name === provider)

  const saving = create.isPending || update.isPending
  const failed = create.isError || update.isError

  function save() {
    const payload = { provider, model, apiKey, apiUrl, maximumTokens }

    if (configuration) {
      update.mutate({ id: configuration.id, ...payload }, { onSuccess: onClose })
      return
    }

    create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div>
        <h3 className="text-sm font-medium">{configuration ? `Editing ${configuration.provider}` : "New configuration"}</h3>
        <p className="text-xs text-muted-foreground">
          {configuration
            ? "Takes effect on the next request — the settings are read per call, not at startup."
            : "Added idle. Putting it in force is a second press, and it is that press which changes what the assistant does."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Provider</span>
          <PlainSelect value={provider} onChange={setProvider}>
            {/* The note beside the name is the point of the richer list: choosing otherwise requires
                already knowing the landscape, and the free ones are exactly the ones somebody new would
                not think to look for. */}
            {providers.map((shipped) => (
              <option key={shipped.name} value={shipped.name}>
                {shipped.name}
                {shipped.requiresKey ? "" : " — no key needed"}
                {shipped.note ? ` · ${shipped.note}` : ""}
              </option>
            ))}
          </PlainSelect>
          {/* ⚠️ Stated where the choice is made rather than discovered at "Put in force". */}
          {chosen?.defaultApiUrl && (
            <span className="text-[11px] text-muted-foreground">
              Defaults to <code className="font-mono">{chosen.defaultApiUrl}</code> — leave the address blank unless
              yours differs.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Model</span>
          <Input
            className="h-8 text-sm"
            value={model}
            placeholder="claude-sonnet-4-5"
            onChange={(event) => setModel(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Tokens per answer</span>
          <Input
            className="h-8 text-sm"
            type="number"
            min={1}
            value={maximumTokens}
            onChange={(event) => setMaximumTokens(Number(event.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Endpoint</span>
          <Input
            className="h-8 text-sm"
            value={apiUrl}
            placeholder="The provider's own, unless you say otherwise"
            onChange={(event) => setApiUrl(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium">API key</span>
          <Input
            className="h-8 font-mono text-sm"
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={
              configuration?.keyConfigured ? "A key is set — leave blank to keep it" : "Required before it can be put in force"
            }
            onChange={(event) => setApiKey(event.target.value)}
          />
          <span className="text-[11px] text-muted-foreground">
            Never shown again after it is saved. Blank means keep the stored one.
          </span>
        </label>
      </div>

      {failed && (
        <Callout tone="danger">
          <span>That was not saved. Check the provider and model, then try again.</span>
        </Callout>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving || model.trim().length === 0 || provider.length === 0} onClick={save}>
          {configuration ? "Save" : "Add it"}
        </Button>
      </div>
    </div>
  )
}
