import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Progress,
  Separator,
  Skeleton,
} from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { GroupDot } from "@/components/GroupDot"
import { LinkRow } from "@/components/LinkRow"
import { groupHues } from "@/lib/groupHues"
import type { KitSection } from "../Specimen"

/** Everything that says something about a row without being a control. */

const FAMILIES = ["access", "entry", "form", "audit", "storage"]
const HUES = groupHues(FAMILIES)

export const marksSection: KitSection = {
  key: "marks",
  label: "Позначки",
  about: "What a row says about itself. None of these is pressable — a mark that looks like a button is a bug.",
  specimens: [
    {
      name: "mark",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Badge",
      what: "One word about a row: its state, its kind, its source.",
      note: (
        <>
          ⚠️ <strong>`destructive` means it takes something away</strong> — a deny, a withholding, a refusal. It is
          not “red because important”.
        </>
      ),
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge>default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="outline">outline</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="ghost">ghost</Badge>
          <Badge variant="secondary" className="font-mono text-[11px]">
            mono
          </Badge>
        </div>
      ),
    },
    {
      name: "dot",
      origin: "product",
      from: "src/components/GroupDot.tsx",
      symbol: "GroupDot",
      what: "Which family a row belongs to, as a colour handed out by position rather than by hashing.",
      note: (
        <>
          ⚠️ <strong>Reinforcement, never the only signal.</strong> The family is always readable as text beside it —
          twelve distinguishable hues cannot avoid red and green.
        </>
      ),
      render: () => (
        <div className="flex flex-wrap items-center gap-3">
          {FAMILIES.map((family) => (
            <span key={family} className="flex items-center gap-1.5 font-mono text-xs">
              <GroupDot hue={HUES.get(family)} label={family} />
              {family}
            </span>
          ))}
        </div>
      ),
    },
    {
      name: "face",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Avatar",
      what: "Who a row is about. Always somewhere — an account that never chose is drawn from its own id.",
      render: () => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="/api/avatars/example" alt="" />
            <AvatarFallback>IH</AvatarFallback>
          </Avatar>
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">CC</AvatarFallback>
          </Avatar>
        </div>
      ),
    },
    {
      name: "callout",
      origin: "product",
      from: "src/components/Callout.tsx",
      symbol: "Callout",
      what: "The sentence on a screen that must not be skimmed past. Each tone carries a glyph, never colour alone.",
      note: "⚠️ Temporary — `@jmouse/markdown` ships the real one, and it arrives under INVT-0057.",
      render: () => (
        <div className="flex w-full flex-col gap-2">
          <Callout tone="info">
            <span>
              <strong>No provider is in force.</strong> The assistant is off and says so.
            </span>
          </Callout>
          <Callout tone="warning">
            <span>
              <strong>It will hold nothing until you grant it something.</strong>
            </span>
          </Callout>
          <Callout tone="danger">
            <span>That did not go through, so nothing has changed.</span>
          </Callout>
          <Callout tone="success">
            <span>2FA is enabled on your account.</span>
          </Callout>
        </div>
      ),
    },
    {
      name: "alert",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Alert",
      what: "The primitive under `callout`, where a title and a body are wanted rather than one sentence.",
      render: () => (
        <Alert className="w-full">
          <AlertTitle>Editing a tier does not reissue it</AlertTitle>
          <AlertDescription>Accounts already on it keep the grants they were given.</AlertDescription>
        </Alert>
      ),
    },
    {
      name: "meter",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Progress",
      what: "How much of an allowance is used. ⚠️ Absent, not empty, where there is no ceiling.",
      note: "A bar at zero percent reads as “you have used none of your quota” when the truth is that there is no quota.",
      render: () => (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Progress value={38} />
          <Progress value={100} />
        </div>
      ),
    },
    {
      name: "waiting",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Skeleton",
      what: "Shaped like what is coming, so the page does not jump when it lands.",
      note: "⚠️ Never a spinner where the shape is known — a spinner says “something is happening”, this says what.",
      render: () => (
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/5" />
        </div>
      ),
    },
    {
      name: "empty",
      origin: "composed",
      from: "src/pages/admin/InvitationsPage.tsx",
      what: "What a list says when it has nothing — a glyph, what is missing, and what to do about it.",
      note: "⚠️ “Nothing matches” and “nothing exists yet” are two different sentences with two different next moves.",
      render: () => (
        <div className="flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-8 text-center">
          <span aria-hidden="true" className="text-2xl">
            ✉
          </span>
          <span className="text-sm font-medium">No invitations yet</span>
          <span className="max-w-md text-xs text-muted-foreground">
            Create a code to share with somebody who should have an account here.
          </span>
        </div>
      ),
    },
    {
      name: "address",
      origin: "product",
      from: "src/components/LinkRow.tsx",
      symbol: "LinkRow",
      what: "A URL shown in full and copyable — because the thing being copied is what has to be checked.",
      render: () => (
        <div className="w-full">
          <LinkRow label="Share token" url="https://innoventa.net/_/category/9f2c1a7e" copied={false} onCopy={() => undefined} />
        </div>
      ),
    },
    {
      name: "rule",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Separator",
      what: "A line between two things that are not the same thing.",
      render: () => (
        <div className="flex w-full max-w-sm flex-col gap-2 text-xs">
          <span>above</span>
          <Separator />
          <span>below</span>
        </div>
      ),
    },
  ],
}
