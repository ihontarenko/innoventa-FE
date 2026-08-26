import { Route, Routes } from "react-router-dom"
import { ApplicationLayout } from "@/components/layout/ApplicationLayout"
import { NavigationContextGate } from "@/components/layout/NavigationContextGate"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AppearanceSettingsPage } from "@/pages/AppearanceSettingsPage"
import { BugReportPage } from "@/pages/BugReportPage"
import { LandingPage } from "@/pages/landing/LandingPage"
import AssistantPage from "@/pages/AssistantPage"
import SavedViewsPage from "@/pages/SavedViewsPage"
import { UiKitPage } from "@/pages/ui-kit/UiKitPage"
import { SettingsPage } from "@/pages/settings/SettingsPage"
import { SpaceSettingsPage } from "@/pages/space/SpaceSettingsPage"
import { AccessControlRoomPage } from "@/pages/admin/AccessControlRoomPage"
import { AdminPage } from "@/pages/admin/AdminPage"
import { AiAdministrationPage } from "@/pages/admin/ai/AiAdministrationPage"
import { InvitationsPage } from "@/pages/admin/InvitationsPage"
import { MappingBuilderPage } from "@/pages/admin/MappingBuilderPage"
import { PlanAdministrationPage } from "@/pages/admin/PlanAdministrationPage"
import { PurposesPage } from "@/pages/admin/PurposesPage"
import { SharingPage } from "@/pages/admin/SharingPage"
import { SystemSettingsPage } from "@/pages/admin/SystemSettingsPage"
import { WorkspaceAdministrationPage } from "@/pages/admin/WorkspaceAdministrationPage"
import { AuditLogPage } from "@/pages/audit/AuditLogPage"
import { EntryPage } from "@/pages/EntryPage"
import { FormBuilderPage } from "@/pages/FormBuilderPage"
import { FieldDetailPage } from "@/pages/workspace/FieldDetailPage"
import { FormManagementPage } from "@/pages/workspace/FormManagementPage"
import { ProjectDetailPage } from "@/pages/ProjectDetailPage"
import { PageDetailPage } from "@/pages/workspace/PageDetailPage"
import { LabelStudioPage } from "@/pages/LabelStudioPage"
import { HubPage } from "@/pages/HubPage"
import { PlaceholderPage } from "@/pages/PlaceholderPage"
import { EmbedFormPage } from "@/pages/public/EmbedFormPage"
import { IdentityCallbackPage } from "@/pages/auth/IdentityCallbackPage"
import { ManualPage } from "@/pages/public/ManualPage"
import { PrettyUrlPage } from "@/pages/public/PrettyUrlPage"
import { PublicEntryPage } from "@/pages/public/PublicEntryPage"
import { PublicFormPage } from "@/pages/public/PublicFormPage"
import { PublicPageView } from "@/pages/public/PublicPageView"
import { PublicViewerPage } from "@/pages/public/PublicViewerPage"
import { PublicAccessError } from "@/components/public/PublicSurface"
import { EmailVerifyPage } from "@/pages/auth/EmailVerifyPage"
import { MagicLinkPage } from "@/pages/auth/MagicLinkPage"
import { MagicLinkVerifyPage } from "@/pages/auth/MagicLinkVerifyPage"
import { OAuth2CallbackPage } from "@/pages/auth/OAuth2CallbackPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { SignInPage } from "@/pages/auth/SignInPage"
import { WorkspaceSectionPage } from "@/pages/WorkspaceSectionPage"
import { StationPage } from "@/pages/station/StationPage"
import { StationsPage } from "@/pages/stations/StationsPage"
import { CraftsPage } from "@/pages/admin/CraftsPage"
import { NavigationScreenLayout } from "@/components/navigation/NavigationScreenLayout"
import { NavigationScreenPage } from "@/components/navigation/NavigationScreenPage"
import { SPACE_ROUTE_ROOT } from "@/lib/navigationContext"
import { navigationItems } from "@/navigation"

/**
 * The routes the skeleton has, and a stub for every menu entry whose screen has not moved.
 *
 * ⚠️ **The stubs are generated from the navigation, not hand-listed.** Two lists of the same screens
 * drift the moment one is edited, and the failure is a menu entry that leads nowhere — which reads as a
 * broken product rather than as unported work.
 *
 * ⚠️ **The gate sits above the layout, not inside a page.** Every workspace-scoped request carries
 * `X-Space-Id` from the store, so nothing below it may render until the address has been resolved into
 * a workspace — see `NavigationContextGate`.
 */
export function ApplicationRoutes() {
  const stubbed = navigationItems.filter((item) => !item.isBuilt && item.path !== "/hub")

  return (
    <Routes>
      {/* ⚠️ Signed-out, every one of them — outside `ProtectedRoute` and outside the layout. A stranger
          reaching any of these has no token, so anything that renders the shell around them would ask
          for a workspace nobody has. */}
      {/* ⚠️ The root is the landing page, not a redirect to the hub. Somebody arriving at innoventa.net
          with no account has to be told what this is; somebody with one gets a nav that already says
          "Go to app". A redirect would answer only the second of them. */}
      <Route path="/" element={<LandingPage />} />

      <Route path="/auth/login" element={<SignInPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/verify-email" element={<EmailVerifyPage />} />
      {/* ⚠️ Before `/auth/magic-link`: react-router picks the more specific path only if it is declared,
          and this is the address the emailed link actually carries. */}
      <Route path="/auth/magic-link/verify" element={<MagicLinkVerifyPage />} />
      <Route path="/auth/magic-link" element={<MagicLinkPage />} />
      <Route path="/auth/oauth2/callback" element={<OAuth2CallbackPage />} />
      <Route path="/auth/identity/callback" element={<IdentityCallbackPage />} />

      {/* ⚠️ **The share surfaces — the only ones reached without an account.** Outside `ProtectedRoute`
          and outside `NavigationContextGate`: a visitor has no token and no workspace, and a gate that
          asked for either would send somebody holding a perfectly good link to a sign-in page.

          ⚠️ `/_/category/*` is deliberately absent, and stays that way: publishing a FOLDER is something
          this product no longer does — the public manual is Kiwi's, embedded.

          ⚠️ `/_/viewer/*` used to be absent for a different reason — "the file endpoints are
          mid-migration" — and that reason expired without the comment noticing. The backend has pointed
          every shared file at `/_/viewer` since sharing was built and `fileLinks.viewer()` has been
          minting the address all along, so the missing route was not a deferral, it was a dead link. */}
      {/* The manual: public, anonymous, read out of Kiwi through this backend as a granted consumer, and
          addressed by the permanent address so a link keeps working. ⚠️ It stays that way permanently —
          those addresses live in Kiwi and are not moving here. */}
      <Route path="/manual" element={<ManualPage />} />
      <Route path="/manual/:address" element={<ManualPage />} />
      <Route path="/_/form/:shareToken" element={<PublicFormPage />} />
      <Route path="/_/form/:shareToken/embed" element={<EmbedFormPage />} />
      <Route path="/_/entry/:shareToken" element={<PublicEntryPage />} />
      {/* A page published out of THIS product's store — a different thing from a manual page, and the
          address `publicPageUrl` mints. */}
      <Route path="/_/page/:shareToken" element={<PublicPageView />} />

      {/* ⚠️ The address the backend has been minting since sharing was built — `FileResourceDescriptor`
          points every shared file at `/_/viewer`, and `fileLinks.viewer()` writes it — while this
          interface had no route for it, so the link fell through to the application's own not-found. */}
      <Route path="/_/viewer/:shareToken" element={<PublicViewerPage />} />

      {/* ⚠️ **The floor under every public address, and it must stay last in this block.** A `/_/` link
          that resolves to nothing is somebody holding a dead or mistyped link, and the one thing they
          must not get is the signed-in application's not-found screen — which offers a way into a
          product they have no account for and says, by existing, that they are somewhere they are not.
          Every public page renders this same notice for a revoked link, so all four read alike. */}
      <Route path="/_/*" element={<PublicAccessError />} />

      <Route
        element={
          <ProtectedRoute>
            <NavigationContextGate />
          </ProtectedRoute>
        }
      >
        {/* ⚠️ **A station is inside the gate and OUTSIDE the layout, deliberately.** Launched from a
            home screen it has no browser chrome to lean on and carries its own; the sidebar and the
            workspace switcher a desktop screen sits inside would be most of a phone's height spent on
            somewhere else. It stays inside the gate because it still needs to know which workspaces
            the reader can reach — a station opens inside one.

            ⚠️ And the address is a REAL entry, not only a route: `/station/components` is its own
            document in the build so it can carry its own manifest. A route here without that entry
            renders the right screen under the shell's installable identity. */}
        <Route path="/station/:stationKey" element={<StationPage />} />

        <Route element={<ApplicationLayout />}>
          <Route path="/hub" element={<HubPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/bug-report" element={<BugReportPage />} />
          <Route path="/stations" element={<StationsPage />} />
          <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
          {/* ⚠️ After the appearance route above: that one is a page of its own reachable from the user
              menu, and react-router picks the more specific path only if it is declared first. */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          {/* ⚠️ **A PATHLESS layout route, and that is what lets the rail hold addresses that share no
              prefix.** `/purposes` is on the Administration rail and stays a platform address — it is
              the one flat entry deliberately kept out of `LEGACY_SPACE_SECTIONS` — and `/admin/mapping`
              is on the Workbench's though it sits under `/admin`. A layout nested under `path="/admin"`
              could express neither. */}
          {/* ⚠️ **`/admin/users`, and `/admin` is no longer this screen.** User management answered at
              `/admin` for as long as administration was one flat menu group; `/admin` is now the
              Administration landing, and Users is the first place on it. Nothing breaks — an old
              bookmark lands on the map instead of on one of its destinations. */}
          <Route element={<NavigationScreenLayout screenKey="administration" />}>
            <Route path="/admin" element={<NavigationScreenPage screenKey="administration" />} />
            <Route path="/admin/users" element={<AdminPage />} />
            <Route path="/admin/access" element={<AccessControlRoomPage />} />
            <Route path="/admin/invitations" element={<InvitationsPage />} />
            <Route path="/admin/crafts" element={<CraftsPage />} />
            <Route path="/admin/settings" element={<SystemSettingsPage />} />
            <Route path="/admin/ai" element={<AiAdministrationPage />} />
            <Route path="/admin/shares" element={<SharingPage />} />
            <Route path="/admin/workspaces" element={<WorkspaceAdministrationPage />} />
            <Route path="/admin/plans" element={<PlanAdministrationPage />} />
            <Route path="/purposes" element={<PurposesPage />} />
          </Route>

          <Route element={<NavigationScreenLayout screenKey="workbench" />}>
            <Route path="/workbench" element={<NavigationScreenPage screenKey="workbench" />} />
            {/* ⚠️ No permission and no data — the kit renders itself, so it answers with the backend down. */}
            <Route path="/ui-kit" element={<UiKitPage />} />
            <Route path="/admin/mapping" element={<MappingBuilderPage />} />
          </Route>

          {/* ⚠️ Outside every rail, and that is the frequency rule made concrete: the audit log is
              administration by any definition and stays a sidebar row because it is opened daily. */}
          <Route path="/audit" element={<AuditLogPage />} />

          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/settings`} element={<SpaceSettingsPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/settings/:tab`} element={<SpaceSettingsPage />} />

          {/* ⚠️ Before the catch-all below: a real screen has to out-rank the section placeholder, and
              react-router picks the more specific path only if it is declared. */}
          {/* ⚠️ Before the builder's route: `manage` is a real screen, and a dynamic `:formId` would
              otherwise swallow it and open the builder for a form whose id is the word "manage". */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/forms/:formId/manage`} element={<FormManagementPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/forms/:formId`} element={<FormBuilderPage />} />
          {/* ⚠️ A field has an address of its own again, as it did in the old interface — openable in
              a tab, linkable, and the destination a phone gets instead of expanding a row in place.
              It has to out-rank the section catch-all below, which would read `fields/{id}` as a
              section nobody has built. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/fields/:fieldId`} element={<FieldDetailPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/projects/:projectId`} element={<ProjectDetailPage />} />

          {/* ⚠️ Before the section catch-all: the studio is a screen of its own, not a section, and
              `labels/:templateId` would otherwise be read as a section named `labels/…`. */}
          {/* ⚠️ A workspace route, NOT a platform one. A saved view belongs to the workspace, and the
              active workspace here is derived from the ADDRESS — the store keeps only the last slug
              visited. On `/saved-views` there was therefore no workspace by construction, so the forms
              half of the page was empty and said nothing about why. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/saved-views`} element={<SavedViewsPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/labels/:templateId`} element={<LabelStudioPage />} />

          {/* ⚠️ Before the section catch-all, for the same reason as the two above: `pages/{id}` is a
              document, and the catch-all would read it as a section named `pages/…`. The section
              itself — the library at `pages` — is still served by the catch-all. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/pages/:pageId`} element={<PageDetailPage />} />

          {/* ⚠️ **Two addresses for one page, and both are kept.** A row reached from the stock screen and
              a row reached from a parametric match are the same record; the older interface minted both
              links, and every one of them that is already in somebody's notes has to keep working. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/entry/:formId/:entryId`} element={<EntryPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/inventory/entry/:formId/:entryId`} element={<EntryPage />} />

          {/* One route for every section of every workspace — see `WorkspaceSectionPage` for why it
              cannot be a list. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug`} element={<WorkspaceSectionPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/*`} element={<WorkspaceSectionPage />} />

          {stubbed.map((item) => (
            <Route
              key={item.key}
              path={item.path}
              element={<PlaceholderPage title={item.label} ticket={item.portedBy ?? "INVT-0051"} />}
            />
          ))}

        </Route>
      </Route>

      {/* ⚠️ **Last, and outside every gate — this is the pretty-URL catch-all.** An administrator can
          mint `/component-manual` as the public address of a shared resource, so any unmatched path may
          turn out to be somebody's link rather than a mistake. It asks the backend, renders the resource
          in place when there is one, and otherwise says nothing is here — see `PrettyUrlPage`, which
          tells a signed-in reader something more useful than it tells a stranger. */}
      <Route path="*" element={<PrettyUrlPage />} />
    </Routes>
  )
}
