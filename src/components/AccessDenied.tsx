import { Badge } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"

/**
 * What a screen says when the reader may not open it.
 *
 * ⚠️ **It names the permission.** "You do not have access" is a dead end: the reader cannot tell whether
 * they are in the wrong workspace, signed in as the wrong account, or looking at something nobody in the
 * building holds — and neither can whoever they ask. A name is the difference between a refusal and an
 * address.
 *
 * ⚠️ **And this is not the authority.** The backend refuses the request whatever this renders; the point
 * of drawing it is that the product stops offering what it is about to refuse.
 */
export function AccessDenied({
  title,
  why,
  permissions,
}: {
  title: string
  /** One sentence in the words of the thing being refused, not in the words of the mechanism. */
  why: string
  permissions: string[]
}) {
  return (
    <>
      <PageHeader title={title} description="Refused here" />

      <div className="flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed p-6">
        <span aria-hidden="true" className="text-2xl">
          ⊘
        </span>
        <p className="text-sm">{why}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Needs</span>
          {permissions.map((permission) => (
            <Badge key={permission} variant="secondary" className="font-mono text-[11px]">
              {permission}
            </Badge>
          ))}
        </div>
      </div>
    </>
  )
}
