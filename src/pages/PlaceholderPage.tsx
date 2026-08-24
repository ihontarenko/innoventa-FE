import { Badge, Card, CardContent } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"

/**
 * A route that exists so the shell is whole, and says plainly that its screen has not moved yet.
 *
 * ⚠️ **It names the ticket that will replace it.** An empty screen with a friendly message is
 * indistinguishable from a broken one; naming the ticket makes the difference readable to whoever opens
 * it, including a future session looking for what is left.
 */
export function PlaceholderPage({
  title,
  ticket,
  detail,
}: {
  title: string
  ticket: string
  detail?: string
}) {
  return (
    <>
      <PageHeader title={title} description="Not ported yet" />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ticket}</Badge>
            <span className="text-sm text-muted-foreground">brings this screen over</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail ??
              "The route is here so the navigation is whole; the screen itself still lives in the old interface and is being ported domain by domain."}
          </p>
        </CardContent>
      </Card>
    </>
  )
}
