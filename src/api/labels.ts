import { http } from "./http";
import type {
    LabelTemplateSummary, LabelTemplateDetail, LabelSubjectDescriptor,
    LabelPlaceholder, SaveLabelTemplatePayload, ResolvedLabelRecord, LabelRecordChoice, LabelElement,
} from '@/types';

/**
 * Label designs — **owned by a person, shared into workspaces**, the way pages are.
 *
 * Reading is `label:read` and writing is `label:write`, both at `SELF`. A design somebody else
 * shared into this workspace is readable and printable but not editable; duplicating it makes a copy
 * that is yours.
 */
export const labelTemplatesApi = {
    /** Mine, plus whatever is shared into the active workspace. */
    list: () =>
        http.get<LabelTemplateSummary[]>('/label-templates'),

    /** The designs that could serve a record on this form — what a print picker offers. */
    forForm: (formId: string) =>
        http.get<LabelTemplateSummary[]>('/label-templates/for-form', { params: { formId } }),

    /**
     * Which of these forms already have a design.
     *
     * Asked once for a whole list rather than once per row: it decides whether a record shows a
     * print button at all, and a button opening onto "nothing to print with" is a dead end.
     */
    /**
     * ⚠️ NO CALLER in this interface yet, and kept deliberately as part of the endpoint surface.
     * It answers "which of these forms already have a design" for a screen listing many forms with a
     * print button per row — which this interface does not have. `LabelPrintButton` hides itself per
     * form, so nothing needs it today.
     */
    coveredForms: (formIds: string[]) =>
        http.get<string[]>('/label-templates/covered-forms', { params: { formIds: formIds.join(',') } }),

    detail: (templateId: string) =>
        http.get<LabelTemplateDetail>(`/label-templates/${templateId}`),

    create: (payload: SaveLabelTemplatePayload) =>
        http.post<LabelTemplateDetail>('/label-templates', payload),

    update: (templateId: string, payload: SaveLabelTemplatePayload) =>
        http.put<LabelTemplateDetail>(`/label-templates/${templateId}`, payload),

    /** A copy, owned by whoever pressed it — how a 12×40 arrives from somebody else's 58×40. */
    duplicate: (templateId: string) =>
        http.post<LabelTemplateDetail>(`/label-templates/${templateId}/duplicate`),

    delete: (templateId: string) =>
        http.delete(`/label-templates/${templateId}`),

    // ── Sharing ───────────────────────────────────────────────────────────────

    shares: (templateId: string) =>
        http.get<string[]>(`/label-templates/${templateId}/shares`),

    /** The whole set at once: "which workspaces is this in" is one question with one answer. */
    share: (templateId: string, spaceIds: string[]) =>
        http.put<string[]>(`/label-templates/${templateId}/shares`, { spaceIds }),
};

/**
 * Using them: what a label may say, and what it says about these records.
 *
 * `resolve` is a round trip on purpose — every element's content is a jME template and jME is Java,
 * so the browser draws and the server interpolates.
 */
export const labelsApi = {
    subjects: () =>
        http.get<LabelSubjectDescriptor[]>('/labels/subjects'),

    fields: (kind: string, formId: string) =>
        http.get<LabelPlaceholder[]>(`/labels/subjects/${kind}/fields`, { params: { formId } }),

    records: (templateId: string, limit = 20) =>
        http.get<LabelRecordChoice[]>(`/labels/${templateId}/records`, { params: { limit } }),

    /**
     * Fill a design in for these records.
     *
     * `elements` is for the studio's preview only — it resolves the design being edited instead of
     * the one last saved, so a mistake is seen while typing. Every real print run omits it, because
     * what prints must be what is stored.
     */
    resolve: (templateId: string, ids: string[], elements?: LabelElement[]) =>
        http.post<ResolvedLabelRecord[]>(`/labels/${templateId}/resolve`, { ids, elements }),
};
