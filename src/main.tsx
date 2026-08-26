import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { initialiseCodeAppearance } from "@jmouse/codemirror/react"
import { registerStationWorker } from "@jmouse/pwa"
import { Application } from "@/Application"
import { stationAt } from "@/stations"

// ⚠️ Before the first render: the syntax palette is an attribute on <html>, so a remembered choice
// restored into a store alone is a preference the page never obeys until somebody re-picks it.
initialiseCodeAppearance("innoventa.code-appearance")

/**
 * ⚠️ **Registered from a station's own address and nowhere else.** Somebody who only ever uses the
 * desktop interface never acquires a service worker, which is the honest default: they did not ask
 * for an offline copy of anything.
 *
 * ⚠️ **But once registered it serves the WHOLE origin**, because the one worker sits at the root
 * scope — that is what makes several stations cost one cache between them rather than one each. So
 * the desktop gets its behaviour too, from the first station anybody installs. Its strategies are
 * conservative by design: navigations and every API prefix go to the network, and only content-hashed
 * assets are ever answered from a cache without asking.
 */
if (stationAt(window.location.pathname) !== null) {
  void registerStationWorker()
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
