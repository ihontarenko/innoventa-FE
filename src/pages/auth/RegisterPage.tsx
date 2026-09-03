import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Button, Input, Label } from "@jmouse/ui"
import { AuthNotice, AuthShell } from "@/components/auth/AuthShell"
import { useRegister } from "@/hooks/useProfile"
import { usePublicConfiguration } from "@/hooks/useSystemSettings"
import { problemDetailOf } from "@/lib/apiErrors"

/**
 * Somebody creating an account, in whichever of the three arrangements this installation is in.
 *
 * ⚠️ **Open, invitation-only, or closed — and the screen is a different screen in each.** Those are read
 * from `/api/public/config`, which answers without a token precisely so this page can ask. An installation that
 * has closed registration and offers no invitations gets told so instead of a form that will be refused.
 */
export function RegisterPage() {
  const register = useRegister()
  const { data: configuration } = usePublicConfiguration()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [invitationCode, setInvitationCode] = useState("")
  const [failure, setFailure] = useState("")
  const [created, setCreated] = useState(false)

  const invitationsRequired = configuration?.["auth.invitation_system"] === "true"
  const registrationClosed = configuration?.["auth.close_registration"] === "true"

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure("")

    try {
      await register.mutateAsync({
        email,
        password,
        displayName: displayName || undefined,
        inviteCode: invitationsRequired ? invitationCode : undefined,
      })
      setCreated(true)
    } catch (error) {
      // ⚠️ A field error on `email` is the one the backend answers for "that address is taken", and it
      // arrives beside the general detail rather than instead of it.
      const fieldFailure = (error as { response?: { data?: { fieldErrors?: Record<string, string> } } })?.response
        ?.data?.fieldErrors?.email

      setFailure(fieldFailure ?? problemDetailOf(error).title)
    }
  }

  if (created) {
    return (
      <AuthShell
        title="Check your inbox"
        footer={<Link to="/auth/login">Back to sign in</Link>}
      >
        <AuthNotice tone="success">
          Account created. Check <strong>{email}</strong> for a verification link.
        </AuthNotice>
      </AuthShell>
    )
  }

  if (registrationClosed && !invitationsRequired) {
    return (
      <AuthShell title="Registration is closed" footer={<Link to="/auth/login">← Back to sign in</Link>}>
        <AuthNotice tone="info">
          New accounts are not being created here at the moment. An administrator can let you in.
        </AuthNotice>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle={
        invitationsRequired
          ? "This installation is invitation-only — enter the code you were given."
          : "Start counting whatever it is you count."
      }
      footer={
        <>
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {invitationsRequired && (
          <Field label="Invitation code" htmlFor="invitation-code">
            <Input
              id="invitation-code"
              autoFocus
              required
              value={invitationCode}
              placeholder="XXXXXXXXXXXXXXXX"
              onChange={(event) => setInvitationCode(event.target.value)}
            />
          </Field>
        )}

        <Field label="Display name" htmlFor="display-name" hint="Optional">
          <Input
            id="display-name"
            autoComplete="name"
            autoFocus={!invitationsRequired}
            value={displayName}
            placeholder="Your name"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            placeholder="you@innoventa.net"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password" hint="At least 8 characters">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            placeholder="••••••••"
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {failure && <AuthNotice tone="error">{failure}</AuthNotice>}

        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="flex items-baseline gap-1.5">
        {label}
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  )
}
