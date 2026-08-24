import { Route, Routes } from "react-router-dom"
import { ApplicationLayout } from "@/components/layout/ApplicationLayout"
import { NavigationContextGate } from "@/components/layout/NavigationContextGate"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { AppearanceSettingsPage } from "@/pages/AppearanceSettingsPage"
import { BugReportPage } from "@/pages/BugReportPage"
import { LandingPage } from "@/pages/landing/LandingPage"
import AssistantPage from "@/pages/AssistantPage"
import { UiKitPage } from "@/pages/ui-kit/UiKitPage"
import { SettingsPage } from "@/pages/settings/SettingsPage"
import { SpaceSettingsPage } from "@/pages/space/SpaceSettingsPage"
import { AccessControlRoomPage } from "@/pages/admin/AccessControlRoomPage"
import { AdminPage } from "@/pages/admin/AdminPage"
import { AiAdministrationPage } from "@/pages/admin/ai/AiAdministrationPage"
import { InvitationsPage } from "@/pages/admin/InvitationsPage"
import { PlanAdministrationPage } from "@/pages/admin/PlanAdministrationPage"
import { PurposesPage } from "@/pages/admin/PurposesPage"
import { SharingPage } from "@/pages/admin/SharingPage"
import { SystemSettingsPage } from "@/pages/admin/SystemSettingsPage"
import { WorkspaceAdministrationPage } from "@/pages/admin/WorkspaceAdministrationPage"
import { AuditLogPage } from "@/pages/audit/AuditLogPage"
import { EntryPage } from "@/pages/EntryPage"
import { FormBuilderPage } from "@/pages/FormBuilderPage"
import { ProjectDetailPage } from "@/pages/ProjectDetailPage"
import { LabelStudioPage } from "@/pages/LabelStudioPage"
import { HubPage } from "@/pages/HubPage"
import { PlaceholderPage } from "@/pages/PlaceholderPage"
import { EmbedFormPage } from "@/pages/public/EmbedFormPage"
import { IdentityCallbackPage } from "@/pages/auth/IdentityCallbackPage"
import { ManualPage } from "@/pages/public/ManualPage"
import { PrettyUrlPage } from "@/pages/public/PrettyUrlPage"
import { PublicEntryPage } from "@/pages/public/PublicEntryPage"
import { PublicFormPage } from "@/pages/public/PublicFormPage"
import { EmailVerifyPage } from "@/pages/auth/EmailVerifyPage"
import { MagicLinkPage } from "@/pages/auth/MagicLinkPage"
import { MagicLinkVerifyPage } from "@/pages/auth/MagicLinkVerifyPage"
import { OAuth2CallbackPage } from "@/pages/auth/OAuth2CallbackPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { SignInPage } from "@/pages/auth/SignInPage"
import { WorkspaceSectionPage } from "@/pages/WorkspaceSectionPage"
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

          ⚠️ `/_/page/*`, `/_/category/*` and `/_/viewer/*` are deliberately absent. Pages move to Kiwi
          (`KW-13`) and the file endpoints are mid-migration, so their public screens are unported
          rather than half-ported — the old interface still answers those addresses. */}
      {/* The manual: public, anonymous, read out of Kiwi through Innoventa (INVT-0116). Addressed by
          the permanent address so a link keeps working (KW-1 §7). */}
      <Route path="/manual" element={<ManualPage />} />
      <Route path="/manual/:address" element={<ManualPage />} />
      <Route path="/_/form/:shareToken" element={<PublicFormPage />} />
      <Route path="/_/form/:shareToken/embed" element={<EmbedFormPage />} />
      <Route path="/_/entry/:shareToken" element={<PublicEntryPage />} />

      <Route
        element={
          <ProtectedRoute>
            <NavigationContextGate />
          </ProtectedRoute>
        }
      >
        <Route element={<ApplicationLayout />}>
          <Route path="/hub" element={<HubPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/bug-report" element={<BugReportPage />} />
          {/* ⚠️ No permission and no data — the kit renders itself, so it answers with the backend down. */}
          <Route path="/ui-kit" element={<UiKitPage />} />
          <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
          {/* ⚠️ After the appearance route above: that one is a page of its own reachable from the user
              menu, and react-router picks the more specific path only if it is declared first. */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="/admin/access" element={<AccessControlRoomPage />} />
          <Route path="/admin/plans" element={<PlanAdministrationPage />} />
          <Route path="/purposes" element={<PurposesPage />} />
          <Route path="/admin/invitations" element={<InvitationsPage />} />
          <Route path="/admin/settings" element={<SystemSettingsPage />} />
          <Route path="/admin/ai" element={<AiAdministrationPage />} />
          <Route path="/admin/shares" element={<SharingPage />} />
          <Route path="/admin/workspaces" element={<WorkspaceAdministrationPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/admin" element={<AdminPage />} />

          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/settings`} element={<SpaceSettingsPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/settings/:tab`} element={<SpaceSettingsPage />} />

          {/* ⚠️ Before the catch-all below: a real screen has to out-rank the section placeholder, and
              react-router picks the more specific path only if it is declared. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/forms/:formId`} element={<FormBuilderPage />} />
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/projects/:projectId`} element={<ProjectDetailPage />} />

          {/* ⚠️ Before the section catch-all: the studio is a screen of its own, not a section, and
              `labels/:templateId` would otherwise be read as a section named `labels/…`. */}
          <Route path={`${SPACE_ROUTE_ROOT}/:spaceSlug/labels/:templateId`} element={<LabelStudioPage />} />

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
