import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  buildInfoApi,
  publicConfigurationApi,
  systemSettingsApi,
  type BackendBuildInfo,
  type SystemSetting,
} from "@/api/settings"

const SETTINGS_KEY = ["system-settings"] as const

export function useSystemSettings() {
  return useQuery<SystemSetting[]>({
    queryKey: SETTINGS_KEY,
    queryFn: () => systemSettingsApi.list().then((response) => response.data),
    staleTime: 30_000,
  })
}

/**
 * ⚠️ **Answers with the stored setting, and the screen shows that rather than what was typed.** Some of
 * these are refused by rules spanning two settings, so a control left where somebody dragged it would be
 * showing a value the installation does not have.
 */
export function useUpdateSystemSetting() {
  const queryClient = useQueryClient()

  return useMutation<SystemSetting, unknown, { key: string; value: string }>({
    mutationFn: ({ key, value }) => systemSettingsApi.update(key, value).then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

/**
 * Which build is answering.
 *
 * ⚠️ `staleTime: Infinity` and `retry: false` — a version label is reference, and a deployment does not
 * change under a reader mid-visit. Retrying it would put a failing request behind every screen that
 * happens to render the footer.
 */
export function useBackendBuildInfo() {
  return useQuery<BackendBuildInfo>({
    queryKey: ["build-info", "backend"],
    queryFn: () => buildInfoApi.backend().then((response) => response.data),
    staleTime: Infinity,
    retry: false,
  })
}

/**
 * What a signed-out screen may know about this installation.
 *
 * ⚠️ **`retry: false`, because the answer being missing is itself an answer.** An installation that has
 * never had its settings table populated returns nothing here, and the registration screen has a
 * perfectly good default for every key it reads — retrying would put a failing request in front of a
 * stranger who is only trying to sign up.
 */
export function usePublicConfiguration() {
  return useQuery<Record<string, string>>({
    queryKey: ["public-configuration"],
    queryFn: () => publicConfigurationApi.read().then((response) => response.data),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
