import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import { ExternalLink, Link2, Trash2 } from "lucide-react"
import { InnoventaMarkdownEditor } from "@/components/markdown/InnoventaMarkdown"
import { PageMarkdown } from "@/components/markdown/PageMarkdown"
import { APP_SURFACE } from "@/components/markdown/surface"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { PageHeader } from "@/components/PageHeader"
import {
  publicPageUrl,
  type PageRenderStyle,
  type PageStatus,
  type PageVisibility,
} from "@/api/pages"
import {
  useDeletePage,
  useDetachPageLink,
  usePage,
  usePageLinks,
  useSetPageShares,
  useSetPageVisibility,
  useUpdatePage,
} from "@/hooks/usePages"
import { useFolders } from "@/hooks/useFolders"
import { useSpaces } from "@/hooks/useSpaces"
import { describeQueryFailure } from "@/lib/loadFailure"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

const RENDER_STYLES: { value: PageRenderStyle; label: string; hint: string }[] = [
  { value: "REGULAR", label: "Regular", hint: "The default voice — an article somebody reads through." },
  { value: "TECHNICAL", label: "Technical", hint: "Tighter, for procedures and datasheets." },
  { value: "EDITORIAL", label: "Editorial", hint: "Wider measure and more air, for long prose." },
  { value: "COMPACT", label: "Compact", hint: "Dense, for a reference somebody scans." },
  { value: "ACADEMIC", label: "Academic", hint: "Serif, for something argued rather than instructed." },
]

const STATUSES: { value: PageStatus; label: string; hint: string }[] = [
  { value: "DRAFT", label: "Draft", hint: "Being written. Visible to you, and to nobody else." },
  { value: "PUBLISHED", label: "Published", hint: "Finished, and readable by whoever the sharing allows." },
  { value: "ARCHIVED", label: "Archived", hint: "Kept, but out of the way." },
]

/**
 * One page: written on the left, or read as it will be read.
 *
 * <h2>⚠️ One renderer for the preview and for the page</h2>
 *
 * The Preview tab goes through {@link PageMarkdown} — the same component a reader gets, on the same
 * surface, so a `:::` block resolves here exactly as it will once saved. Two renderers is how a callout
 * comes out one colour while writing and another once published, with nobody able to say which one is
 * the document.
 *
 * <h2>⚠️ Two independent answers to "who can see this"</h2>
 *
 * **Visibility** is whether a stranger holding the link can read it. **Shares** are which workspaces it
 * appears in. Neither implies the other, and the screen says so rather than folding them into one
 * switch: a page can be shared into a workspace and still be unreachable from the open internet, which
 * is the ordinary case and would be the surprising one if the two were merged.
 *
 * <h2>⚠️ Visibility and shares save immediately; everything else waits for Save</h2>
 *
 * They are their own endpoints because they are their own decisions — publishing mints a share link,
 * and a draft body sitting in a textarea should not decide when that happens.
 */
export function PageDetailPage() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)

  const pageQuery = usePage(pageId)
  const foldersQuery = useFolders()
  const spacesQuery = useSpaces()
  const linksQuery = usePageLinks(pageId)

  const updatePage = useUpdatePage()
  const setVisibility = useSetPageVisibility()
  const setShares = useSetPageShares()
  const detachLink = useDetachPageLink()
  const deletePage = useDeletePage()

  const [tab, setTab] = useState<"write" | "preview" | "sharing">("write")
  const [title, setTitle] = useState("")
  const [folderId, setFolderId] = useState<string>("")
  const [renderStyle, setRenderStyle] = useState<PageRenderStyle>("REGULAR")
  const [status, setStatus] = useState<PageStatus>("DRAFT")
  const [content, setContent] = useState("")

  const page = pageQuery.data
  const failure = describeQueryFailure(pageQuery, "page")

  // Fills the form once the page arrives, and again whenever a different page is opened. Keyed on the
  // id rather than on the object: a refetch that answers with the same page must not overwrite what
  // somebody has since typed into it.
  useEffect(() => {
    if (!page) {
      return
    }

    setTitle(page.title)
    setFolderId(page.categoryId ?? "")
    setRenderStyle(page.renderStyle)
    setStatus(page.status)
    setContent(page.contentMarkdown ?? "")
  }, [page?.id])

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => pageQuery.refetch()} />
  }

  if (pageQuery.isLoading || !page) {
    return <Skeleton className="h-96 w-full" />
  }

  const pagesPath = spaceSectionPath(spaceSlug ?? "", "pages")
  const isPublic = page.visibility === "PUBLIC"
  const publicAddress = isPublic && page.shareToken ? publicPageUrl(page.shareToken) : null

  const save = () => {
    updatePage.mutate(
      {
        pageId: page.id,
        payload: {
          title,
          // ⚠️ `null` and not `undefined`: undefined means "leave it alone", and taking a page out of
          // every folder has to be sayable. An empty string would be a folder id nothing matches.
          categoryId: folderId || null,
          contentMarkdown: content,
          renderStyle,
          status,
        },
      },
      {
        onSuccess: () => toast.success("Saved."),
        onError: () => toast.error("Could not save this page."),
      },
    )
  }

  const togglePublic = (next: PageVisibility) => {
    setVisibility.mutate(
      { pageId: page.id, visibility: next },
      {
        onSuccess: () =>
          toast.success(next === "PUBLIC" ? "Published — anybody with the link can read it." : "No longer public."),
        onError: () => toast.error("Could not change who can see this page."),
      },
    )
  }

  const toggleShare = (spaceId: string) => {
    // ⚠️ The whole set, never the difference — see `pagesApi.setShares`.
    const next = page.sharedSpaceIds.includes(spaceId)
      ? page.sharedSpaceIds.filter((candidate) => candidate !== spaceId)
      : [...page.sharedSpaceIds, spaceId]

    setShares.mutate(
      { pageId: page.id, spaceIds: next },
      { onError: () => toast.error("Could not change which workspaces see this page.") },
    )
  }

  return (
    <>
      <PageHeader
        title={title || "Untitled page"}
        description={
          <Link to={pagesPath} className="hover:underline">
            ← Pages
          </Link>
        }
        actions={
          <>
            <Badge variant={status === "PUBLISHED" ? "default" : "outline"}>
              {STATUSES.find((option) => option.value === status)?.label}
            </Badge>
            {publicAddress && (
              <Button size="sm" variant="ghost" asChild>
                <a href={publicAddress} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" /> Public
                </a>
              </Button>
            )}
            <Button size="sm" disabled={updatePage.isPending} onClick={save}>
              Save
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as typeof tab)}
        className="flex min-h-0 flex-1 flex-col gap-4"
      >
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="sharing">Sharing</TabsTrigger>
        </TabsList>

        {tab === "write" && (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Title">
                <Input value={title} placeholder="Page title" onChange={(event) => setTitle(event.target.value)} />
              </Field>

              <Field label="Folder">
                <Select value={folderId || "none"} onValueChange={(value) => setFolderId(value === "none" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unfiled</SelectItem>
                    {foldersQuery.data?.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {/* The tree arrives in nested-set order, so indentation alone reads as a tree. */}
                        {" ".repeat(folder.depth * 2)}
                        {folder.icon ? `${folder.icon} ` : ""}
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Render style">
                <Select value={renderStyle} onValueChange={(value) => setRenderStyle(value as PageRenderStyle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENDER_STYLES.map((option) => (
                      <SelectItem key={option.value} value={option.value} title={option.hint}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Status">
                <Select value={status} onValueChange={(value) => setStatus(value as PageStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((option) => (
                      <SelectItem key={option.value} value={option.value} title={option.hint}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <InnoventaMarkdownEditor
              value={content}
              onChange={setContent}
              height="30rem"
              placeholder={"# Heading\n\nWrite **Markdown** here…\n\n- a list item\n- another"}
            />
          </div>
        )}

        {tab === "preview" && (
          <div className="min-h-0 overflow-y-auto rounded-md border p-6">
            {/* ⚠️ `APP_SURFACE`, so the live blocks resolve exactly as they will once saved — a preview
                showing a notice where the page will show a number is not a preview. */}
            <PageMarkdown markdown={content} surface={APP_SURFACE} renderStyle={renderStyle} />
          </div>
        )}

        {tab === "sharing" && (
          <div className="flex max-w-3xl flex-col gap-6">
            <section className="flex flex-col gap-2">
              <SectionTitle>Anyone with the link</SectionTitle>
              <p className="text-muted-foreground text-xs">
                Publishing mints a permanent address. Turning it off does not just hide the page — the
                address stops resolving for everybody who already has it.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isPublic ? "outline" : "default"}
                  disabled={setVisibility.isPending}
                  onClick={() => togglePublic(isPublic ? "PRIVATE" : "PUBLIC")}
                >
                  {isPublic ? "Make private" : "Publish publicly"}
                </Button>
                {publicAddress && (
                  <code className="bg-muted truncate rounded px-2 py-1 text-[11px]">{publicAddress}</code>
                )}
              </div>

              {/* ⚠️ Public and yet unreachable, which is a real state rather than a rendering slip: the
                  visibility is a column and the address is a minted link, and seeded content sets the
                  first without the second. Saying nothing here would show a reader a page marked public
                  with no way to reach it, and leave them to guess which half is lying. */}
              {isPublic && !publicAddress && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Marked public, but no link has ever been minted — so nobody can actually reach it.
                  Make it private and publish it again to mint one.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <SectionTitle>Workspaces</SectionTitle>
              <p className="text-muted-foreground text-xs">
                Which workspaces list this page. Separate from the public link — a page can be in a
                workspace and still be unreachable from outside.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {spacesQuery.data?.map((space) => {
                  const shared = page.sharedSpaceIds.includes(space.id)

                  return (
                    <Button
                      key={space.id}
                      size="sm"
                      variant={shared ? "default" : "outline"}
                      disabled={setShares.isPending}
                      onClick={() => toggleShare(space.id)}
                    >
                      {space.name}
                      {space.id === activeSpaceId ? " · here" : ""}
                    </Button>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <SectionTitle>What this page documents</SectionTitle>
              <p className="text-muted-foreground text-xs">
                Records and projects this page is attached to. Attaching happens on their screens, where
                the thing being documented is what you are looking at.
              </p>
              {linksQuery.data && linksQuery.data.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {linksQuery.data.map((link) => (
                    <li
                      key={`${link.targetType}-${link.targetId}`}
                      className="flex items-center justify-between rounded border px-3 py-1.5 text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Link2 className="size-3" />
                        <Badge variant="secondary">{link.targetType.toLowerCase()}</Badge>
                        {link.targetLabel}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          detachLink.mutate({
                            pageId: page.id,
                            targetType: link.targetType,
                            targetId: link.targetId,
                          })
                        }
                      >
                        Detach
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">Not attached to anything yet.</p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <SectionTitle>Delete</SectionTitle>
              <p className="text-muted-foreground text-xs">
                The document and its attachments go. Anything published from it stops resolving.
              </p>
              <Button
                size="sm"
                variant="destructive"
                className="self-start"
                disabled={deletePage.isPending}
                onClick={() =>
                  deletePage.mutate(page.id, {
                    onSuccess: () => {
                      toast.success(`${page.title} deleted.`)
                      navigate(pagesPath)
                    },
                    onError: () => toast.error("Could not delete this page."),
                  })
                }
              >
                <Trash2 className="size-3.5" /> Delete this page
              </Button>
            </section>
          </div>
        )}
      </Tabs>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[11px] font-medium tracking-[0.04em] uppercase">{label}</span>
      {children}
    </label>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold tracking-[0.04em] uppercase">{children}</span>
}
