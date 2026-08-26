import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { MapperTransportProvider, MappingBuilder, type MappingFormModel } from "@jmouse/mapper"
import { Button } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { mapperTransport } from "@/lib/mapperTransport"

/**
 * The `.jmm` mapping builder, mounted.
 *
 * ## ⚠️ The screen is the library's; this file is the mounting and nothing else
 *
 * A mapping builder is about a jMouse *language*, so it lives in `@jmouse/mapper` and every product that
 * wants one takes the same screen. What belongs here is what only Innoventa can answer: which client the
 * requests go through, where the page sits in the navigation, and what a person does with the document
 * once it exists.
 *
 * ## ⚠️ The transport is provided HERE rather than at the application root
 *
 * The filter builder's provider is at the root because that panel appears on a dozen screens. This one
 * appears on exactly this screen, and a provider at the root would make every page pay for a context
 * nothing else reads.
 */
export function MappingBuilderPage() {
  const [form, setForm] = useState<MappingFormModel>({
    name: "innoventa/mapping",
    targets: [{ type: "", always: [], sources: [{ type: "", rules: [] }] }],
  })

  const [document, setDocument] = useState("")
  const { copied, copy } = useCopyFeedback()

  return (
    <MapperTransportProvider value={mapperTransport}>
      <PageHeader
        title="Mapping builder"
        description="Compose a .jmm document from a form. The second tab is the document itself, rendered by the server."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={document === ""}
            onClick={() => copy(document)}
          >
            {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
            Copy the document
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-5xl py-6">
        <MappingBuilder value={form} onChange={setForm} onDocument={setDocument} />
      </div>
    </MapperTransportProvider>
  )
}
