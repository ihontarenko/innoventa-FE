import { useState } from "react"
import { Button, cn } from "@jmouse/ui"
import { useAgentConnectionInfo } from "@/hooks/useAgents"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"

/**
 * How to point a client at this installation — the half of the agents screen that was missing.
 *
 * ⚠️ **Why this exists at all.** The product has spoken the Model Context Protocol for as long as it has
 * had agents, and the interface never said so anywhere. The endpoint, the sign-in, the approval screen
 * and the per-client credential all worked; nothing told anybody the address. Writing that down where
 * somebody will look for it is the difference between a feature and a feature nobody finds.
 *
 * ⚠️ **The address comes from the server, not from `window.location`.** The protocol endpoint sits behind
 * whatever proxy this installation runs, and the browser's origin is right only where the two coincide.
 * Guessing would hand somebody an address their client cannot reach, which reads as the client being
 * broken.
 */
export function ConnectClientSection() {
  const [client, setClient] = useState<ClientKind>("claude-code")

  const { data } = useAgentConnectionInfo()

  // Until the server answers, this page's own origin is a better guess than an empty box: it is right in
  // every deployment and wrong only in development, which is the one place somebody knows both ports.
  const endpoint = data?.serverUrl ?? `${window.location.origin}/api/mcp`
  const chosen = instructionsFor(client, endpoint)

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">Connect a client</h3>

      {/* ⚠️ The ceiling rather than "acts as you". An agent restricted to its own permissions does
          strictly less, so "exactly what you can do" stopped being true — what holds in both cases is:
          never more than you, sometimes less. */}
      <p className="text-xs text-muted-foreground">
        This product speaks the Model Context Protocol, so a client can read your inventory, fill forms, write pages and
        search across everything you can reach. It acts as an <strong>agent</strong> working for you — never able to do
        more than you can, in no workspace you are not a member of, and less than that wherever the agent has been
        restricted.
      </p>

      <CopyableBlock label="Server URL" value={endpoint} />

      <div className="flex flex-wrap gap-1">
        {CLIENTS.map((offered) => (
          <button
            key={offered.id}
            type="button"
            onClick={() => setClient(offered.id)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              client === offered.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {offered.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{chosen.hint}</p>

      <CopyableBlock label={chosen.label} value={chosen.snippet} />

      <div className="flex flex-col gap-2 text-xs text-muted-foreground">
        <p>
          <strong>You will be asked to sign in, and then to approve.</strong> The client opens your browser, you sign in
          as usual, and one screen names the client and the address on this machine its code will be sent to. Approving
          it is what creates the connection — nothing is issued to a client nobody said yes to.
        </p>
        <p>
          <strong>The credential works here and nowhere else.</strong> It is signed for this one endpoint, so it is not a
          token that can read the rest of the API, and it is not the token your browser holds. End it whenever you like —
          the client stops on its next call, not whenever its token would have expired.
        </p>
        <p>
          ⚠️ <strong>A refusal is not a bug.</strong> The client is held to the same permissions you are: a workspace you
          are not in does not appear to it, and an action you may not take is refused with the reason.
        </p>
      </div>
    </section>
  )
}

type ClientKind = "claude-code" | "claude-desktop" | "codex" | "chatgpt"

const CLIENTS: { id: ClientKind; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "codex", label: "Codex" },
  { id: "chatgpt", label: "ChatGPT" },
]

interface Instructions {
  label: string
  hint: string
  snippet: string
}

function instructionsFor(client: ClientKind, endpoint: string): Instructions {
  switch (client) {
    case "claude-desktop":
      return {
        label: "claude_desktop_config.json",
        hint: "Settings → Developer → Edit Config, then restart Claude Desktop.",
        snippet: JSON.stringify({ mcpServers: { innoventa: { type: "http", url: endpoint } } }, null, 2),
      }
    case "codex":
      return {
        label: "Terminal",
        hint: "Writes the server into ~/.codex/config.toml.",
        snippet: `codex mcp add innoventa --url ${endpoint}`,
      }
    case "chatgpt":
      return {
        label: "No command — it is added in the interface",
        hint:
          "ChatGPT adds servers as connectors rather than from a terminal: Settings → Connectors → Add custom " +
          "connector, then paste the URL. It has to be an address ChatGPT's servers can reach, so a localhost URL " +
          "will not work.",
        snippet: endpoint,
      }
    default:
      return {
        label: "Terminal",
        hint:
          "Adds it to this machine. Use --scope project to commit it to .mcp.json for the whole team, or " +
          "--scope user for every project you open.",
        snippet: `claude mcp add --transport http innoventa ${endpoint}`,
      }
  }
}

/** ⚠️ A button rather than "select this text": the snippets are long and one of them is JSON. */
function CopyableBlock({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopyFeedback()

  return (
    <div className="flex flex-col gap-1 rounded-md border">
      <div className="flex items-center gap-2 border-b px-2 py-1">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void copy(value)}>
          {copied ? "✓ Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto px-2 pb-2 font-mono text-[11px] whitespace-pre-wrap">{value}</pre>
    </div>
  )
}
