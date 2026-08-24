import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { initialiseCodeAppearance } from "@jmouse/codemirror/react"
import { Application } from "@/Application"

// ⚠️ Before the first render: the syntax palette is an attribute on <html>, so a remembered choice
// restored into a store alone is a preference the page never obeys until somebody re-picks it.
initialiseCodeAppearance("innoventa.code-appearance")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
