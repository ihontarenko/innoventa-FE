import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Button, Input, Label } from "@jmouse/ui"
import { AuthNotice, AuthShell } from "@/components/auth/AuthShell"
import { authApi } from "@/api/auth"

/**
 * Signing in without a password.
 *
 * ⚠️ **It reports success whether or not the address exists, and that is the feature.** A screen that
 * said "no account for that address" would answer, for free and unauthenticated, the question *is this
 * person a customer* — for any address anybody cares to type. So the request's outcome is deliberately
 * not shown; what is shown is what was *asked*, in a sentence that is true either way.
 */
export function MagicLinkPage() {
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [asked, setAsked] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSending(true)

    try {
      await authApi.requestMagicLink(email)
    } catch {
      // Swallowed on purpose — see the note above. A failure here is either the address not existing,
      // which must not be disclosed, or the mail server being unhappy, which the person cannot act on.
    } finally {
      setSending(false)
      setAsked(true)
    }
  }

  return (
    <AuthShell
      title="Magic link"
      subtitle="We will email you a one-click sign-in link."
      footer={<Link to="/auth/login">← Back to sign in</Link>}
    >
      {asked ? (
        <AuthNotice tone="success">
          If an account exists for <strong>{email}</strong>, a sign-in link is on its way. Check your inbox.
        </AuthNotice>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              placeholder="you@innoventa.net"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send magic link"}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
