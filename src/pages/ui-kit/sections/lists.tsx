import { useState } from "react"
import {
  Badge,
  Button,
  Row,
  RowAction,
  RowGroup,
  RowKey,
  RowList,
  RowMeta,
  RowTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import { Pagination } from "@/components/Pagination"
import type { KitSection } from "../Specimen"

/**
 * How a set of things is laid out — and the one decision that separates the two shapes.
 */

const RELATIONS = [
  { key: "TSSR-79", title: "A Members screen under Administration, with the All / People / Clients control" },
  { key: "TSSR-80", title: "Edit a member from the Members screen — display name and avatar" },
  { key: "TSSR-81", title: "Renaming an agent leaves no trace — the audited directory has no counterpart" },
]

function PaginationSpecimen() {
  const [page, setPage] = useState(1)

  return <Pagination page={page} totalPages={5} totalElements={214} size={50} onChange={setPage} />
}

function TabsSpecimen() {
  const [value, setValue] = useState("provider")

  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList>
        <TabsTrigger value="provider">Provider</TabsTrigger>
        <TabsTrigger value="prompt">Prompt</TabsTrigger>
        <TabsTrigger value="actions">
          Actions
          <Badge variant="secondary" className="ml-1.5 font-mono text-[10px]">
            34
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

export const listsSection: KitSection = {
  key: "lists",
  label: "Списки",
  about: "A row is one subject; a table is one column compared down a page. Pick by which question is being asked.",
  specimens: [
    {
      name: "row",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Row · RowList · RowTitle · RowKey · RowMeta · RowAction",
      what: "A list of things you act on: a glyph, a key, a name, marks, and a control that appears on hover.",
      note: (
        <>
          ⚠️ <strong>Not a table.</strong> Where every column but one holds a badge, the headings label nothing
          anybody is comparing — and the question is *which of these is the one I want*, which is a name.
        </>
      ),
      render: () => (
        <RowGroup label="Children" tally="3 of 3 done" className="w-full">
          <RowList>
            {RELATIONS.map((relation) => (
              <Row
                key={relation.key}
                leading={
                  <>
                    <span aria-hidden="true">⛓</span>
                    <RowKey className="w-20">{relation.key}</RowKey>
                  </>
                }
                trailing={
                  <>
                    <Badge variant="secondary">DONE</Badge>
                    <RowAction>
                      <button type="button" className="px-1 text-xs text-muted-foreground hover:text-destructive">
                        ✕
                      </button>
                    </RowAction>
                  </>
                }
                onOpen={() => undefined}
              >
                <RowTitle>{relation.title}</RowTitle>
              </Row>
            ))}
          </RowList>
        </RowGroup>
      ),
    },
    {
      name: "row/carded",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Row variant=\"carded\"",
      what: "The same row with a border of its own — for a list where every entry has a second line.",
      note: "A description on a shared ground reads as a row of its own; the border is what keeps the pair one thing.",
      render: () => (
        <RowList variant="carded" className="w-full">
          <Row
            variant="carded"
            leading={<span aria-hidden="true">◈</span>}
            trailing={<Badge variant="secondary">on</Badge>}
          >
            <RowTitle>Parts catalog</RowTitle>
            <RowMeta>Reads through Forms — switching it off takes the item out of the menu and refuses nothing.</RowMeta>
          </Row>
          <Row variant="carded" tone="muted" leading={<span aria-hidden="true">⊘</span>}>
            <RowTitle>Custody</RowTitle>
            <RowMeta>Not included in the plan.</RowMeta>
          </Row>
          <Row variant="carded" tone="danger" leading={<span aria-hidden="true">⊘</span>}>
            <RowTitle>Parametric search</RowTitle>
            <RowMeta>Withheld by an administrator — “until the migration lands”.</RowMeta>
          </Row>
        </RowList>
      ),
    },
    {
      name: "row/group",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "RowGroup",
      what: "A heading with the tally on the far right — what the group is, and whether it needs anything.",
      note: (
        <>
          ⚠️ <strong>The tally is the heading's other half.</strong> “Children” says what it is; “3 of 3 done” says
          whether to look. A group heading without one is a label.
        </>
      ),
      render: () => (
        <div className="flex w-full flex-col gap-3">
          <RowGroup label="Tracks" tally="6 of 6 done">
            <RowList>
              <Row leading={<RowKey className="w-20">INVT-44</RowKey>} trailing={<Badge variant="secondary">DONE</Badge>}>
                <RowTitle>Edit a client from the people list</RowTitle>
              </Row>
            </RowList>
          </RowGroup>

          <RowGroup label="Blocked by" tally="1 open" action={<Button variant="ghost" size="sm">+ Link</Button>}>
            <RowList>
              <Row leading={<RowKey className="w-20">KW-13</RowKey>} trailing={<Badge>WIP</Badge>}>
                <RowTitle>Innoventa's half of the pages migration</RowTitle>
              </Row>
            </RowList>
          </RowGroup>
        </div>
      ),
    },
    {
      name: "table",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Table",
      what: "For comparing a column down a page — an amount, a time, a count.",
      note: "⚠️ If every column but one is a badge, it wanted `row`.",
      render: () => (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Seats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-xs">free</TableCell>
                <TableCell className="font-mono text-xs">10</TableCell>
                <TableCell className="font-mono text-xs">2</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-xs">business</TableCell>
                <TableCell className="font-mono text-xs">30</TableCell>
                <TableCell className="font-mono text-xs">unlimited</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ),
    },
    {
      name: "pagination",
      origin: "product",
      from: "src/components/Pagination.tsx",
      symbol: "Pagination",
      what: "Where in a long result somebody is — with the total stated rather than implied.",
      note: "⚠️ A page of fifty that looks like the whole list is how somebody concludes a record does not exist.",
      render: () => (
        <div className="w-full overflow-hidden rounded-md border">
          <PaginationSpecimen />
        </div>
      ),
    },
    {
      name: "tabs",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Tabs",
      what: "One screen, several surfaces over the same subject. A count belongs in the trigger.",
      note: "⚠️ Where the surfaces are twelve, it is a side navigation instead — see the access control room.",
      render: () => <TabsSpecimen />,
    },
  ],
}
