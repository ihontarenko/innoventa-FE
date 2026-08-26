import { ExternalLink, FileText } from "lucide-react"
import { Button } from "@jmouse/ui"
import { FieldValue } from "@/components/form/FieldValue"
import { hostOf } from "@/lib/webAddress"
import type { FieldDetail, FormEntry } from "@/types"

/**
 * The pictures a record carries, drawn as pictures.
 *
 * ⚠️ **An address to a `.jpg` is not a link, whatever its field type says.** Printed as a truncated URL
 * it is the one value on the page nobody can read anything from, while the thing it points at is often
 * the most useful thing there is. So the field's *name* decides here and the element type does not —
 * `image_url` holds a picture no matter that it is stored as a URL.
 */
export function EntryImageView({ entry, fields }: { entry: FormEntry; fields: FieldDetail[] }) {
  const filled = fields.filter((field) => !!entry.fieldValues[field.name])

  if (filled.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
        This type carries {fields.length} picture field{fields.length === 1 ? "" : "s"}, and none is
        filled in.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filled.map((field) => (
        <figure key={field.id} className="overflow-hidden rounded-lg border bg-card">
          <figcaption className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <span className="flex-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {field.icon ? `${field.icon} ` : ""}
              {field.label}
            </span>

            {/* ⚠️ Offered only where the value is somewhere to go. A stored file is drawn from bytes this
                installation holds and has no page of its own to open. */}
            {entry.fieldValues[field.name]?.startsWith("http") && (
              <Button asChild variant="ghost" size="xs">
                <a href={entry.fieldValues[field.name]} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open
                </a>
              </Button>
            )}
          </figcaption>

          {/* ⚠️ A light ground under the picture, whatever the theme. Component photographs are cut out
              on white, so on a dark surface they arrive as a white rectangle with a bevel around it.

              ⚠️ **A minimum height on the FRAME, and no minimum on the picture.** A distributor's
              thumbnail is often 100px across: left to itself it renders in a strip barely taller than
              the caption, which reads as a broken panel — and stretched to fill it would be a blur
              presented as a photograph. So the frame is a consistent size and the picture sits in the
              middle of it at whatever size it really is. */}
          <div className="grid min-h-[240px] place-items-center bg-white p-6 dark:bg-zinc-100">
            <FieldValue
              value={entry.fieldValues[field.name] ?? ""}
              elementType="IMAGE"
              imageClassName="max-h-[420px] w-auto max-w-full object-contain"
            />
          </div>
        </figure>
      ))}
    </div>
  )
}

/**
 * A datasheet that lives somewhere else.
 *
 * ⚠️ **A link, and deliberately NOT an embed.** `/_/file/{token}` is this installation's own address and
 * an iframe may show it; a distributor's PDF is a third-party origin that usually refuses to be framed,
 * and an embed that silently renders blank is worse than an honest link. Which is also why this is its
 * own view rather than a line in the document tab: the two are different things — one is a copy this
 * installation keeps, the other is a line somebody follows to a distributor who may retire it.
 */
export function EntryDatasheetLinkView({ entry, field }: { entry: FormEntry; field: FieldDetail }) {
  const address = entry.fieldValues[field.name] ?? ""

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <FileText className="size-4.5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {field.label}
          </span>
          <span className="min-w-0 text-sm break-all">
            <FieldValue value={address} elementType="URL" />
          </span>
        </div>

        {/* ⚠️ Named after the host, like every other configured address on this page — a control that
            says only *Open* leaves the reader to parse a truncated URL to find out where. */}
        <Button asChild size="sm" className="shrink-0">
          <a href={address} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {hostOf(address) ? `Open on ${hostOf(address)}` : "Open"}
          </a>
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Held by whoever published it, so it is opened rather than shown here — and it can stop resolving
        without this record changing. A copy uploaded into the datasheet file field is read on this page
        and outlives them.
      </p>
    </section>
  )
}
