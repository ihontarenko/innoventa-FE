import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@jmouse/ui"
import type { KitSection } from "../Specimen"

/** The parts that frame a screen rather than sit inside one. */

export const shellSection: KitSection = {
  key: "shell",
  label: "Каркас",
  about: "What frames a screen: its title, its refusals, and the two ways a page navigates itself.",
  specimens: [
    {
      name: "page-header",
      origin: "product",
      from: "src/components/PageHeader.tsx",
      symbol: "PageHeader",
      what: "The title, one line of what the screen is, and the actions that belong to the whole page.",
      note: (
        <>
          ⚠️ <strong>Always the first child of the content area.</strong> It cancels the wrapper's padding so its
          rule reaches the true edges — placed lower, it draws a stray line across the middle of a screen.
        </>
      ),
      render: () => (
        <div className="w-full overflow-hidden rounded-md border">
          <header className="flex items-end justify-between gap-4 border-b bg-background px-6 pt-[18px] pb-[13px]">
            <div>
              <h1 className="font-display text-lg font-semibold tracking-[-0.02em]">Access control</h1>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Why one person may do one thing — and the document that decides it
              </div>
            </div>
            <Button size="sm">Rehearse</Button>
          </header>
        </div>
      ),
    },
    {
      name: "side-nav",
      origin: "composed",
      from: "src/components/layout/ApplicationSidebar.tsx",
      symbol: "@jmouse/ui · Sidebar*",
      what: "Twelve destinations behind one address — a flat column, with the open one in the address bar.",
      note: (
        <>
          ⚠️ <strong>Where tabs stop working.</strong> Three levels of navigation collapsed into one list is what
          made the access control room readable; a tab strip over twelve surfaces hides most of them.
          <br />
          The column itself is the library's `Sidebar`. What belongs to this product is which
          destinations go in it and how they are grouped — `src/navigation`.
        </>
      ),
      render: () => (
        <nav className="flex w-56 flex-col gap-0.5 rounded-md border p-2">
          <div className="mt-1 mb-1 px-2 text-[10px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
            Answers
          </div>
          {[
            { glyph: "☺", label: "Who", active: true, count: 6 },
            { glyph: "⌕", label: "What", active: false },
            { glyph: "⚖", label: "Simulate", active: false },
          ].map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                item.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
              }`}
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {item.glyph}
              </span>
              <span className="truncate">{item.label}</span>
              {item.count !== undefined && (
                <Badge variant="outline" className="ml-auto font-mono text-[10px] text-current">
                  {item.count}
                </Badge>
              )}
            </span>
          ))}
        </nav>
      ),
    },
    {
      name: "crumbs",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Breadcrumb",
      what: "Where a screen sits, when it sits under something.",
      render: () => (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Hobby & DIY Workshop</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Workspace settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ),
    },
    {
      name: "refused",
      origin: "product",
      from: "src/components/AccessDenied.tsx",
      symbol: "AccessDenied",
      what: "What a screen says to somebody who may not open it — naming the permission.",
      note: (
        <>
          ⚠️ <strong>“You do not have access” is a dead end.</strong> A name is the difference between a refusal and
          an address — and this is never the authority: the backend refuses whatever this renders.
        </>
      ),
      render: () => (
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed p-6">
          <span aria-hidden="true" className="text-2xl">
            ⊘
          </span>
          <p className="text-sm">
            The audit log is everything that has happened across the installation, so it is read with a permission held
            over the installation rather than in one workspace.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Needs</span>
            <Badge variant="secondary" className="font-mono text-[11px]">
              audit:read
            </Badge>
          </div>
        </div>
      ),
    },
    {
      name: "card",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Card",
      what: "A box with a title. ⚠️ Rarely the right answer — most lists want `row`, most screens want a rule.",
      note: "Six cards for six one-line settings is a page you scroll to find a toggle.",
      render: () => (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>Unlimited people, generous storage, everything the product has.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">· Custody · Unlimited entries · 25 workspaces</CardContent>
        </Card>
      ),
    },
  ],
}
