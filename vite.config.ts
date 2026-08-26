import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { jmousePwa } from '@jmouse/pwa/vite'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
// ⚠️ Relative, not `@/…`: the alias below configures the APPLICATION's resolver and this file is read
// before it exists. And `./src/lib/mark` deliberately imports nothing — see the note in it.
import { stationDefinitions } from './src/stationDefinitions.js'
import { DEFAULT_MARK_PALETTE, drawMark } from './src/lib/mark.js'

/**
 * Which build is answering, stamped in at build time.
 *
 * ⚠️ **The system-settings footer prints this beside the backend's own build**, and the pair is the
 * whole point: "it works on my machine" is usually two halves of different ages. A missing frontend
 * half turns that screen into a backend version nobody can compare anything to.
 */
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }
const applicationVersion = packageJson.version

function readBuildHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    // ⚠️ `Innoventa/FE` is not a repository of its own and may be built from a tarball. A random
    // suffix keeps two builds of the same version distinguishable, which is all this is for.
    return Math.random().toString(36).slice(2, 9)
  }
}

const buildHash = readBuildHash()
const buildDate = (() => {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${day}${month}${now.getFullYear()}`
})()

const buildId = `build-${buildDate}-${buildHash}-v_${applicationVersion}`

/**
 * The backend this dev server forwards to — the same one the old `UI/` talks to, because the two
 * interfaces are the same product and only one of them is being rebuilt.
 */
const apiTarget = process.env.INNOVENTA_API_TARGET ?? 'http://localhost:8080'

/**
 * ⚠️ **5010, and it must not be 5173.** The old `Innoventa/UI` runs on 5173 for the whole migration
 * (`INVT-46`), and innoventa.net's public :80 is forwarded to that port from outside this repository.
 * Taking it would replace the live interface with a half-built one; the two run side by side until
 * `INVT-0058` retires the old one.
 *
 * ⚠️ **And 5010 is not a free number picked to stay out of the way — it is the one five other places
 * already name** (`INVT-0095`), so moving off it breaks each of them silently:
 *
 * - `Kiwi/BE` and `Tessera/BE` both carry `http://localhost:5010` in their CORS allowlists as
 *   Innoventa's slot, and this interface is the one that calls Kiwi across origins (`HUB-1`). On any
 *   other port the browser is refused at the preflight, before a request leaves it.
 * - `Innoventa/BE`'s `innoventa.mail.base-url` defaults to it — the address printed into outgoing mail.
 * - `Moneta/UI`'s Help page points its iframe at it.
 * - `Identity/BE` registers it as the `innoventa` client's redirect and post-logout URI. ⚠️ That one is
 *   not load-bearing *today* — this backend mints its own token pair and registers only `google` and
 *   `github` as OAuth2 clients, so it is not an Identity client the way Tessera and Kiwi are — but it
 *   is the port Identity is already holding for the day it becomes one.
 *
 * It is also the family port: Moneta 5020, Tessera 5050, Kiwi 5070, Innoventa 5010.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // One manifest per station, one service worker for all of them, and the mark painted into each
    // station's icons. See `src/stationDefinitions.ts` for why that list is read here as well as by
    // the interface.
    jmousePwa({
      stations: stationDefinitions,
      applicationName: 'Innoventa',
      themeColor: DEFAULT_MARK_PALETTE.plate,
      backgroundColor: '#ffffff',
      language: 'en',
      paintIcons: {
        draw: (_station, colours) => drawMark(colours),
        colours: DEFAULT_MARK_PALETTE,
        // ⚠️ iOS reads THIS and ignores the manifest icons entirely; with no PNG it puts a screenshot
        // of the page on the home screen. Re-render it with `node scripts/paint-apple-touch-icon.mjs`
        // whenever the mark changes.
        appleTouchIcon: () => '/apple-touch-icon.png',
      },
      // ⚠️ `/kiwi-api` joins `/api` because it is another product's backend reached across origins —
      // an answer a cache could serve is an answer about somebody else's authorization.
      // ⚠️ `/jmouse` covers every library at once now — see the proxy entry below for why there is one
      // rule rather than one per library.
      serviceWorker: { networkOnlyPrefixes: ['/api', '/kiwi-api', '/jmouse', '/oauth2', '/login'] },
    }),
  ],
  /**
   * ⚠️ **One HTML entry per station, and they cannot be consolidated.** A browser reads the manifest
   * from the document it loaded, so a single-entry application can offer exactly one installable
   * identity — whichever manifest happened to be linked at load. Swapping `<link rel="manifest">`
   * after a client-side navigation does not reliably re-arm the installation prompt.
   *
   * ⚠️ **This is not duplication and must not be "simplified" away.** All the entries share one bundle
   * graph, so the stations cost one worker and one precache between them; the only thing that differs
   * is which manifest each document names. Consolidating them breaks installation and nothing else,
   * which means it fails quietly, months later, on somebody's phone.
   */
  build: {
    rollupOptions: {
      input: {
        shell: fileURLToPath(new URL('./index.html', import.meta.url)),
        components: fileURLToPath(new URL('./station/components/index.html', import.meta.url)),
      },
    },
  },
  define: {
    __APPLICATION_VERSION__: JSON.stringify(applicationVersion),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_HASH__: JSON.stringify(buildHash),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
  // ⚠️ **Two copies of React are what a locally LINKED package gives you, and the symptom is
  // "Invalid hook call".** `@jmouse/ui` is installed from a path while it is unpublished, so its own
  // `node_modules` — devDependencies, React among them — sits inside the link and Vite resolves the
  // package's `react` there instead of here. Hooks then run against a React that never rendered
  // anything and `useState` is null. Deduping pins one copy for the whole graph; it stays correct
  // after publication, where the peer dependency would resolve here anyway.
  // ⚠️ The CodeMirror packages are here for the same reason React is, and leaving them out fails in a
  // way that names neither them nor this file: *"Unrecognized extension value in extension set … this
  // sometimes happens because multiple instances of @codemirror/state are loaded, breaking instanceof
  // checks"*, thrown the moment somebody clicks into a page to edit it, taking the whole screen with it.
  //
  // Two linked packages each bring their own copy — `@jmouse/markdown` supplies the editor and
  // `@jmouse/codemirror` supplies the grammar it is configured with — and they resolve through
  // `../../../jmouse-ui/node_modules`, not this one. An extension built against one copy is not an
  // `instanceof` the other's, so the editor rejects its own configuration (INVT-0121).
  dedupe: [
    'react',
    'react-dom',
    '@codemirror/state',
    '@codemirror/view',
    '@codemirror/language',
    '@lezer/common',
    '@lezer/highlight',
  ],
    alias: {
      // `fileURLToPath` rather than `__dirname`: Vite's native config loader is becoming the default
      // and does not define the CommonJS one. ⚠️ And rather than `new URL(...).pathname`, which on
      // Windows yields `/C:/…` — a path nothing on disk answers to.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: ["innoventa.net"],
    host:  '0.0.0.0',
    port: 5010,
    strictPort: true,
    proxy: {
      // Innoventa's own API — and where the token is refreshed, whichever client hit the 401.
      '/api': { target: apiTarget, changeOrigin: true, xfwd: true, timeout: 120_000, proxyTimeout: 120_000 },
      // ⚠️ **Kiwi, and it is ANOTHER PRODUCT'S backend** (INVT-0097). Proxied only so development sees a
      // same-origin call; in a deployment the browser reaches `:8110` directly and Kiwi's own CORS
      // allowlist is what permits it — which is why Kiwi is the one backend here that has one.
      //
      // ⚠️ The token that travels over this path is the **Identity** one this interface acquires
      // separately (`auth/identityAuth`), never `innoventa.access` and never the product's own consumer
      // credential. See `api/kiwiClient.ts` for why each of those would be wrong.
      '/kiwi-api': {
        target: process.env.INNOVENTA_KIWI_TARGET ?? 'http://localhost:8110',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/kiwi-api/, '/api'),
      },
      // ⚠️ **Every jMouse library, in one rule** (Ivan, 2026-08-25). Files, AI, the query builder and
      // live blocks all answer under `/jmouse/<namespace>/api` now, so this entry is the last one this
      // file will ever need for a library — the previous arrangement was an entry per library
      // (`/jmai`, `/jmouse-files`) and a fourth one forgotten every time a module arrived.
      //
      // ⚠️ The address is still written in two files that nothing compares: the backend composes it and
      // `src/api/libraryRoutes.ts` is the interface's only copy. When they drift every call 404s and no
      // screen raises an error of its own — a file manager with no files, AI screens with no providers.
      '/jmouse': { target: apiTarget, changeOrigin: true, xfwd: true },
      // Backend-served bytes. Everything else under `/_/` is an SPA route, so an avatar left
      // unproxied is answered with index.html and every picture becomes a broken image in dev only.
      '/_/file': { target: apiTarget, changeOrigin: true, xfwd: true },
      '/_/avatar': { target: apiTarget, changeOrigin: true, xfwd: true },
      '/share': { target: apiTarget, changeOrigin: true, xfwd: true },
      '/oauth2': { target: apiTarget, changeOrigin: true, xfwd: true },
      '/login': { target: apiTarget, changeOrigin: true, xfwd: true },
      '/actuator': { target: apiTarget, changeOrigin: true },
      // MCP clients discover authorization here, and the location is dictated by RFC 8414 / RFC 9728
      // rather than chosen. Left unforwarded it lands on the SPA, which answers 200 with an HTML page,
      // and a client reports a parse failure instead of "not supported".
      '/.well-known': { target: apiTarget, changeOrigin: true },
    },
  },
})

