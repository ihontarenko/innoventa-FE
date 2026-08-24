import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { modulesApi, spaceSettingsApi, type SpaceDetail, type SpaceForm, type SubjectArea } from "@/api/spaces"
import type { SpaceModule } from "@/api/entitlements"

/**
 * One workspace, as configured from inside it.
 *
 * ⚠️ **Every write invalidates `["spaces"]` as a whole**, not just this workspace: a rename changes the
 * switcher, a module switched off changes the menu the sidebar reads, and leaving changes the list. A
 * screen that refreshed only what it wrote would leave the sidebar naming a workspace nobody is in.
 */
export function useSpace(spaceId?: string) {
  return useQuery<SpaceDetail>({
    queryKey: ["spaces", spaceId, "detail"],
    queryFn: () => spaceSettingsApi.get(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useSpaceModules(spaceId?: string) {
  return useQuery<SpaceModule[]>({
    queryKey: ["spaces", spaceId, "modules"],
    queryFn: () => modulesApi.listForSpace(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useSubjectAreas() {
  return useQuery<SubjectArea[]>({
    queryKey: ["subject-areas"],
    queryFn: () => spaceSettingsApi.subjectAreas().then((response) => response.data),
    // What a workspace may count is a catalogue; it changes with a deployment, not mid-visit.
    staleTime: 5 * 60_000,
  })
}

function useSpaceMutation<Variables, Result>(send: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient()

  return useMutation<Result, unknown, Variables>({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["spaces"] }),
  })
}

export function useUpdateSpace() {
  return useSpaceMutation(
    ({
      spaceId,
      ...payload
    }: {
      spaceId: string
      name?: string
      description?: string
      discoverable?: boolean
      subjectAreaCode?: string
      // ⚠️ "" CLEARS the branch; omitting the key leaves it alone. Every other field here reads absent
      // as unchanged, which works because none of them can be unset — this one can (INVT-0120).
      kiwiRootCategoryId?: string
    }) => spaceSettingsApi.update(spaceId, payload).then((response) => response.data),
  )
}

export function useDeleteSpace() {
  return useSpaceMutation((spaceId: string) => spaceSettingsApi.delete(spaceId).then(() => undefined))
}

export function useLeaveSpace() {
  return useSpaceMutation((spaceId: string) => spaceSettingsApi.leave(spaceId).then(() => undefined))
}

/**
 * ⚠️ **One field, and the server decides what it is.** An identifier and an email are told apart by the
 * `@`, because a screen that made somebody choose between two boxes would be asking them to know which
 * of the two they had been given.
 */
export function useInviteMember() {
  return useSpaceMutation(({ spaceId, identifier, role }: { spaceId: string; identifier: string; role: string }) =>
    spaceSettingsApi
      .inviteMember(spaceId, identifier.includes("@") ? { email: identifier, role } : { userId: identifier, role })
      .then((response) => response.data),
  )
}

export function useUpdateMemberRole() {
  return useSpaceMutation(({ spaceId, userId, role }: { spaceId: string; userId: string; role: string }) =>
    spaceSettingsApi.updateMemberRole(spaceId, userId, role).then((response) => response.data),
  )
}

export function useRemoveMember() {
  return useSpaceMutation(({ spaceId, userId }: { spaceId: string; userId: string }) =>
    spaceSettingsApi.removeMember(spaceId, userId).then(() => undefined),
  )
}

export function useSetSpaceModule() {
  return useSpaceMutation(
    ({ spaceId, moduleKey, enabled, forced }: { spaceId: string; moduleKey: string; enabled: boolean; forced: boolean }) =>
      modulesApi.setModule(spaceId, moduleKey, { enabled, forced }).then((response) => response.data),
  )
}

export function useSpaceForms(spaceId?: string) {
  return useQuery<SpaceForm[]>({
    queryKey: ["spaces", spaceId, "forms"],
    queryFn: () => spaceSettingsApi.forms(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useAvailableSpaceForms(spaceId?: string) {
  return useQuery<SpaceForm[]>({
    queryKey: ["spaces", spaceId, "forms", "available"],
    queryFn: () => spaceSettingsApi.availableForms(spaceId!).then((response) => response.data),
    enabled: Boolean(spaceId),
  })
}

export function useAddSpaceForm() {
  return useSpaceMutation(({ spaceId, formId }: { spaceId: string; formId: string }) =>
    spaceSettingsApi.addForm(spaceId, formId).then(() => undefined),
  )
}

export function useRemoveSpaceForm() {
  return useSpaceMutation(({ spaceId, formId }: { spaceId: string; formId: string }) =>
    spaceSettingsApi.removeForm(spaceId, formId).then(() => undefined),
  )
}
