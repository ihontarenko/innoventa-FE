import { http } from "./http"

/**
 * Runtime configuration — the knobs that decide how the whole installation behaves.
 *
 * ⚠️ **The control is derived from the setting, never from a list of keys in the browser.** `shape`
 * says whether a value is a flag, a choice, a bounded number or free text, so a new setting arrives
 * with the right control already. A hardcoded key list here is a screen that renders next quarter's
 * settings as text boxes and calls it a feature.
 */

/** How a value is entered. `TEXT` is the fallback, and the only one that needs an explicit save. */
export type SettingKind = "FLAG" | "CHOICE" | "RANGE" | "TEXT"

export interface SettingShape {
  kind: SettingKind
  minimum: number | null
  maximum: number | null
  step: number | null
  choices: { value: string; label: string }[]
}

export interface SystemSetting {
  key: string
  value: string
  description: string | null
  shape: SettingShape
  updatedAt: string | null
}

/**
 * What is actually running on the other side.
 *
 * @property codename what this release goes by in conversation — derived from `version`, so it is
 *           stable everywhere. The name is what a person quotes; the number beside it is what they
 *           compare, and neither does the other's job.
 */
export interface BackendBuildInfo {
  artifact: string
  version: string
  codename: string
  buildTime: string | null
  gitHash: string | null
  gitBranch: string | null
  gitMessage: string | null
  dirty: boolean
  buildId: string
}

export const systemSettingsApi = {
  list: () => http.get<SystemSetting[]>("/admin/settings"),

  update: (key: string, value: string) => http.put<SystemSetting>(`/admin/settings/${key}`, { value }),
}

export const buildInfoApi = {
  backend: () => http.get<BackendBuildInfo>("/public/build-info"),
}

/**
 * The handful of settings a signed-OUT screen is allowed to read.
 *
 * ⚠️ **A different endpoint from `/admin/settings`, and deliberately so.** The registration screen has to
 * know whether registration is open and whether an invitation code is required *before* anybody has an
 * account — so this one route answers without a token, and answers with the few keys that decide what a
 * stranger is shown. Reaching for the administration list here would 401 on the one screen that cannot
 * recover from a 401.
 */
export const publicConfigurationApi = {
  read: () => http.get<Record<string, string>>("/public/config"),
}
