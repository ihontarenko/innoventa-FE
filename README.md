# Innoventa/FE

The new interface — Vite + React 19 + Tailwind v4 + shadcn through **`@jmouse/ui`**, the layer Tessera
and Kiwi are drawn with. Tracked by `INVT-46`; this skeleton is `INVT-0052`.

```bash
./jm.sh up innoventa:be innoventa:fe   # from the workspace root
```

Then open **http://localhost:5010**.

⚠️ **The old `Innoventa/UI` is still the real interface** and runs beside this one on 5173 for the
whole migration. It is not edited and not deleted until `INVT-0058`, and this app must never take its
port: innoventa.net's public :80 is forwarded to 5173 from outside the repository.

⚠️ **5010, and it is not an arbitrary free number** (`INVT-0095`, 2026-08-20 — it was 5083, and this
file said 5175, a third value). Kiwi's and Tessera's CORS allowlists carry `http://localhost:5010` as
Innoventa's slot, `innoventa.mail.base-url` prints it into outgoing mail, and Moneta's Help page points
its iframe at it. `Innoventa/FE/vite.config.ts` decides the value with `strictPort`; `jm.sh` has to
agree, and the two drifting apart is what `INVT-0067` was.

## What is here

The shell and the plumbing, and a stub for every screen that has not moved yet — each one naming the
ticket that brings it. The stubs are generated from `src/navigation.ts` rather than listed, so a menu
entry can never lead nowhere.

- **Auth is Innoventa's own.** This backend mints its own token pair at `/api/auth/*`; it is not an
  Identity client the way Tessera and Kiwi are. `src/api/http.ts` carries the refresh queue, the
  `X-Space-Id` header and the two base paths (`/api` and the AI management prefix).
- ⚠️ **Web-storage keys are the old interface's** (`innoventa.access`, `innoventa.refresh`,
  `innoventa.theme-mode`, …). Both interfaces run against one backend, and a second set of names would
  mean signing in twice and disagreeing about the theme.
- ⚠️ **No `src/components/ui/`, and no `*.module.css`.** Primitives come from `@jmouse/ui`; a CSS
  module in here is a decision that has to be argued for in the ticket, not a habit carried over.
- ⚠️ **The navigation is the platform context only.** A workspace's menu is *served* — it depends on
  which modules that workspace presents — so it cannot be a list in the browser. It arrives with
  `INVT-0055`.
