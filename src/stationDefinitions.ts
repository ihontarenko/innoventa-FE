import type { StationDefinition } from "@jmouse/pwa"

/**
 * The stations this interface builds — one installable application each.
 *
 * ⚠️ **Read by `vite.config.ts` as well as by the interface, which is why there is no glyph here.**
 * The build runs in Node and cannot hold a rendered icon; a second list for the build to read would
 * be the same stations declared twice, and the drift would show up as a tile whose manifest points at
 * an address the interface does not route. `stations.tsx` adds the glyphs on top of this one.
 *
 * ⚠️ **Every entry needs a matching HTML entry in `vite.config.ts`'s `rollupOptions.input`**, and
 * adding one without the other fails in opposite directions — a station with no entry installs the
 * shell's identity instead of its own, an entry with no station gets no manifest at all. Both look
 * like a working build.
 *
 * ⚠️ **This list and the backend's are two halves of one fact, joined by `key`.** A station's manifest
 * is a static file written at build time, so the interface must hold its own list whatever the server
 * says; and which stations a person is *offered* turns on their permissions and their workspaces'
 * modules, which a browser does not hold. The **backend owns whether**, this file owns **what it is**.
 *
 * ⚠️ **A station is a task, never a role.** `Components`, `Stocktake`, `Entries` — never `Admin` or
 * `Manager`. A role decides which of these a person is offered; it never becomes one, because an
 * administrator's station would be the whole desktop shrunk onto a phone.
 */
export const stationDefinitions: StationDefinition[] = [
  {
    key: "components",
    name: "Components",
    shortName: "Components",
    description: "Look a component up, adjust what is in stock, attach a photograph.",
    startPath: "/station/components",
  },
]
