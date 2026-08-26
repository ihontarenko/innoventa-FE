import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@jmouse/ui"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { publicShareSurface } from "@/components/markdown/surface"
import { publicPagesApi } from "@/api/public"

/**
 * A published page, read by somebody with no account.
 *
 * <h2>⚠️ Holding the link is the whole authorisation</h2>
 *
 * There is no workspace here, no permission and no session — which is why this screen sits outside the
 * protected routes and outside the shell. Anything that asked for a workspace would send a visitor
 * holding a perfectly good link to a sign-in page they were never meant to see.
 *
 * <h2>⚠️ One failure sentence, because there is only one thing a visitor can do about it</h2>
 *
 * Unpublished, deleted, mistyped and revoked are four different facts on the server and the same
 * situation out here. Distinguishing them in the message would be telling a stranger whether a page they
 * cannot read exists.
 */
export function PublicPageView() {
  const { shareToken } = useParams<{ shareToken: string }>()

  const page = useQuery({
    queryKey: ["public-page", shareToken],
    queryFn: () => publicPagesApi.get(shareToken!).then((response) => response.data),
    enabled: Boolean(shareToken),
    // A link that is not going to work is not going to work on the fourth attempt either, and each retry
    // is another second of a blank screen.
    retry: false,
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10">
      <header className="flex items-baseline gap-2 border-b pb-3">
        <span className="text-sm font-semibold tracking-tight">Innoventa</span>
        {page.data && (
          <span className="text-muted-foreground text-[11px]">
            updated {new Date(page.data.updatedAt).toLocaleDateString()}
          </span>
        )}
      </header>

      {page.isLoading && <Skeleton className="h-72 w-full" />}

      {!page.isLoading && !page.data && (
        <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-12 text-center">
          <span aria-hidden="true" className="text-2xl">
            🔗
          </span>
          <span className="text-sm font-medium">This page is not available</span>
          <span className="text-muted-foreground max-w-md text-xs">
            The link may have been turned off, or it may never have been public.
          </span>
        </div>
      )}

      {page.data && (
        <article className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{page.data.title}</h1>
          {/* The visitor's surface: the public-safe blocks resolve, everything operational comes back
              visibly restricted rather than quietly missing. */}
          <PageMarkdown
            markdown={page.data.contentMarkdown}
            surface={publicShareSurface(shareToken!)}
            renderStyle={page.data.renderStyle}
          />
        </article>
      )}
    </div>
  )
}
