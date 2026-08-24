import { allThemes } from "@jmouse/ui/presets"

/**
 * A palette asked for by the address rather than by a person.
 *
 * ⚠️ **This exists for embeds, and only for embeds.** Every other surface has somebody signed in with a
 * stored preference; an embed is rendered inside a stranger's page for a reader who has no account here,
 * so whoever wrote the embed code is the only one who can say what it should look like. `?theme=dracula`
 * is where they say it.
 *
 * ⚠️ **An unknown name is ignored, never applied.** A query string is written by anybody, and a theme
 * class that matches no palette leaves a page with no colours at all — which reads as a broken product
 * rather than as a typo in an embed tag.
 *
 * ⚠️ **`?scale=` is deliberately NOT read here.** It is the embed's zoom — a continuous factor on the
 * whole surface, applied through `--surface-scale` — whereas the theme's `fontScale` is a four-step
 * named ladder for the application's own type. Feeding one into the other would scale an embed twice,
 * once by 1.25 and once by "large", and neither number would explain the result.
 */
export function addressedTheme(): { themeName: string } | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  const asked = new URLSearchParams(window.location.search).get("theme")

  if (!asked || !allThemes.some((theme) => theme.name === asked)) {
    return undefined
  }

  return { themeName: asked }
}
