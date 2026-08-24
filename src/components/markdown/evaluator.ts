import type { JmeEvaluator } from "@jmouse/markdown/jme"
import { jmeApi } from "@/api/jme"
import type { InnoventaMarkdownContext } from "./surface"

/**
 * Which endpoint evaluates a `;;;jme` applet.
 *
 * ⚠️ **A question of reachability, not of permission.** In-app an applet evaluates against the
 * authenticated endpoint; on a shared page or an inert preview that endpoint cannot be reached at all,
 * so the public one answers. Keeping the whole distinction in one small function is what stops it
 * becoming a branch inside the block renderer.
 *
 * ⚠️ **A binding declares its input *type*, never a field id.** The evaluator receives `{ code,
 * variables }` and nothing else, so a block that borrowed a form field's control would look bound to a
 * form it was never bound to. The trade — losing a field's own unit and option list — buys a block that
 * means the same thing in-app, on a shared page, in an embed and pasted into another product.
 */
const authenticated: JmeEvaluator = (request) => jmeApi.execute(request).then((response) => response.data)

const publicly: JmeEvaluator = (request) => jmeApi.executePublic(request).then((response) => response.data)

export function innoventaEvaluator(context: InnoventaMarkdownContext): JmeEvaluator {
  return context.surface.kind === "app" ? authenticated : publicly
}

/**
 * The branded-viewer address for an Innoventa file image, so clicking one in a page opens it full size.
 *
 * ⚠️ **The whole of what the library is told about our URLs.** The size-hint syntax
 * `![alt](url 320x240)` is generic and lives in the library; knowing that `/_/file/{token}` is one of
 * ours is not, and this is that knowledge.
 */
export function fileViewerHref(source?: string): string | null {
  const match = source ? /\/_\/file\/([^/?#]+)/.exec(source) : null

  return match ? `/_/viewer/${match[1]}` : null
}
