import { http } from "./http"

/**
 * The policy editor's half of `/admin/access`.
 *
 * <p>⚠️ **One document, two surfaces.** The form edits a `PolicyDocumentView`; the code pane is that
 * document written out by the server; typing in the code pane parses back into the document. The
 * browser never renders `.jmp` itself — a second renderer of the grammar disagrees with the first
 * inside a month, and the first thing it gets wrong is quoting.
 *
 * <p>⚠️ **And the browser never decides whether a policy is valid.** `validate` runs the real parser
 * and the real binder. The CodeMirror mode in `@jmouse/codemirror` only colours.
 */

/** Which stage refused, because three failures have three different next moves. */
export type PolicyProblemStage = "PARSE" | "BIND" | "GUARD";

/** One thing wrong, and where. `line` is 0 where the complaint is about the document as a whole. */
export interface PolicyProblemView {
    line:    number;
    column:  number;
    message: string;
    stage:   PolicyProblemStage;
}

export interface PolicyValidationView {
    valid:    boolean;
    problems: PolicyProblemView[];
    roles:    number;
    subjects: number;
}

/** A permission inside a role, and how far the role carries it — a scope name, never an instance. */
export interface PolicyBundleEntryView {
    permission: string;
    scope:      string;
}

export interface PolicyRoleView {
    name:   string;
    bundle: PolicyBundleEntryView[];
}

export interface PolicyAssignmentView {
    roleName: string;
    scope:    string;
    instance: string | null;
}

export interface PolicyGrantView {
    permission: string;
    scope:      string;
    instance:   string | null;
    effect:     "ALLOW" | "DENY";
    condition:  string | null;
}

export interface PolicySubjectView {
    id:     string;
    roles:  PolicyAssignmentView[];
    grants: PolicyGrantView[];
}

/**
 * @property beyondTheForm constructions the form cannot render — `include`, a vocabulary block, a
 *           comment. Shown rather than dropped: silently deleting somebody's `# why this exists` is
 *           how a team stops trusting the screen.
 */
export interface PolicyDocumentView {
    name:          string;
    roles:         PolicyRoleView[];
    subjects:      PolicySubjectView[];
    capabilities:  PolicyCapabilityView[];
    plans:         PolicyPlanView[];
    entitlements:  PolicyEntitlementView[];
    beyondTheForm: string[];
}

/** What a tier is *allowed to contain* — the catalogue half of the document. */
export interface PolicyCapabilityView {
    key:         string;
    displayName: string;
    kind:        string;
    scopes:      string[];
    paid:        boolean;
}

/**
 * One tier.
 *
 * @property extendsCode the tier this one builds on, or null. ⚠️ `lines` are the ones this tier
 *           *writes*, never its resolved contents — rendering the inherited ones would make a save
 *           flatten the inheritance into a copy that drifts from its base at the first edit.
 */
export interface PolicyPlanView {
    code:        string;
    displayName: string;
    order:       number;
    note:        string | null;
    extendsCode: string | null;
    lines:       PolicyPlanLineView[];
}

/**
 * @property quantity as written — `25`, `100GB` — because what a unit means is the product's
 *           knowledge and the form must show back what somebody typed.
 * @property unlimited ⚠️ **not a very large quantity.** A ceiling that exists and one that does not
 *           are different facts, and the form renders them differently.
 */
export interface PolicyPlanLineView {
    capability: string;
    quantity:   string | null;
    period:     string | null;
    unlimited:  boolean;
}

export type PolicyEntitlementKind = "PLAN" | "TRIAL" | "ALLOW" | "DENY";

/**
 * One grant somebody wrote down deliberately.
 *
 * @property subject the tier code on a `PLAN`/`TRIAL` line, the capability key otherwise.
 * @property from ⚠️ a window is a qualifier on the grant and never a condition: a predicate is
 *           opaque, so an expired grant inside one would be indistinguishable from a refused one —
 *           no date to quote, and nothing for a date field to hold.
 */
export interface PolicyEntitlementView {
    scope:     string;
    instance:  string | null;
    kind:      PolicyEntitlementKind;
    subject:   string;
    quantity:  string | null;
    unlimited: boolean;
    from:      string | null;
    until:     string | null;
    reason:    string | null;
}

export interface PolicyExchangeView {
    source:   string;
    document: PolicyDocumentView | null;
    checked:  PolicyValidationView;
}

export interface PolicyScopeOption {
    name:            string;
    nature:          string;
    namesAnInstance: boolean;
}

export interface PolicyPermissionOption {
    name:            string;
    description:     string | null;
    narrowestScope:  string | null;
}

/**
 * One thing a policy may name by identifier.
 *
 * <p>`id` is what gets written into the file — the half that has to be exact. `name` and `hint` are
 * what make the picker usable: a control showing only identifiers is one people use by pasting, and
 * pasting is how the wrong workspace gets a grant.
 */
export interface PolicyInstanceOption {
    id:   string;
    name: string;
    hint: string | null;
}

/** A page of them, because these are bounded by the customer rather than by the build. */
export interface PolicyInstancePage {
    options: PolicyInstanceOption[];
    page:    number;
    total:   number;
    hasMore: boolean;
}

/** Which unbounded vocabulary to search — a place's instances, or an account. */
export type PolicyInstanceKind = "SPACE" | "ORGANIZATION" | "SUBJECT";

/**
 * One grant somebody asked to override, carried from the *Who* view into the document.
 *
 * <p>⚠️ **There is no "remove" here on purpose.** Deleting the grant is possible now that a grant
 * lives in one place, and is still the wrong move from a screen whose whole subject is *why* somebody
 * holds something: a rule that came from somewhere structural comes back the next time that structure
 * is seeded, and a power that vanishes with nothing to read is the mystery this cluster exists to end.
 * So overriding writes a `deny`, which wins over the grant while leaving both visible.
 */
export interface PolicyOverrideSeed {
    subjectId:  string;
    permission: string;
    scope:      string;
    instance:   string | null;
}

/**
 * The **closed** vocabulary — everything there is a bounded set of.
 *
 * <p>⚠️ Workspaces, accounts and people are deliberately not here. They are bounded by how big the
 * customer is rather than by what the build knows, so they are searched through `policyApi.instances`
 * one page at a time instead of listed. The form's pickers and the editor's completion both read
 * that, so the two surfaces still cannot disagree about what exists.
 */
export interface PolicyVocabularyView {
    scopes:        PolicyScopeOption[];
    permissions:   PolicyPermissionOption[];
    roles:         string[];
    editableRoles: string[];
    capabilities:  PolicyCapabilityOption[];
    plans:         string[];
    actions:       PolicyActionOption[];
    variables:     PolicyVariableOption[];
}

/**
 * One action a rule may scope itself to, and the values it carries.
 *
 * ⚠️ **The two together are what makes a rule writable.** An action on its own lets somebody write
 * `action == "entry.listByPurpose"` and then guess at what may be compared beside it — and a guess
 * that names a real value published by a *different* action produces a rule that never fires and
 * says nothing. Offering the pair is what turns a magic string into a vocabulary.
 *
 * A `description` of `null` means the policy file has not caught up with the build. Say so rather
 * than showing a blank: it means the vocabulary somebody is reading is one feature behind.
 */
export interface PolicyActionOption {
    name:        string;
    description: string | null;
    values:      string[];
}

/**
 * One value that is true of **every** decision, whatever the call is doing.
 *
 * ⚠️ **Offered separately from an action's `values`, and that separation is the whole point.** These
 * used to be listed inside every action's values, because that is where the checker could find them —
 * which told anyone reading the completion that `entry.listByPurpose` produces the deployment name.
 * A rule may read one of these under any action, or under none.
 *
 * `kind` is `CONSTANT` where the value is settled before any call arrives, or `DYNAMIC` where it is
 * worked out from the call being decided. Worth showing beside the name: it is the difference between
 * a rule that can and cannot see two answers in two requests.
 */
export interface PolicyVariableOption {
    name:        string;
    kind:        "CONSTANT" | "DYNAMIC";
    description: string | null;
}

/**
 * Everything a grant or a tier line may be about.
 *
 * ⚠️ Read from the registered **catalogue**, not from the document's `capabilities { }` block. Those
 * are different sets on purpose: the block declares only what a tier *could* contain — everything
 * paid and everything metered — so a picker built from it could not offer a free module, and a free
 * module is exactly what a `deny` is usually written about.
 */
export interface PolicyCapabilityOption {
    key:    string;
    label:  string;
    kind:   string;
    scopes: string[];
    paid:   boolean;
}

export interface PolicySubjectChange {
    userId: string;
    email:  string;
    scope:  string;
    gains:  string[];
    losses: string[];
}

/**
 * @property capabilityChanges what accounts would gain or lose. ⚠️ Kept apart from `changes` because
 *           the two are read by different people and mean different things: one is who could suddenly
 *           **do** something, the other is who would gain or lose something they are **paying** for.
 *           A permission somebody quietly gains is found by whoever audits; a capability an account
 *           quietly loses is found by the customer, immediately, and reported as a fault.
 */
export interface PolicyDryRunView {
    valid:             boolean;
    problems:          PolicyProblemView[];
    changes:           PolicySubjectChange[];
    examined:          number;
    warnings:          string[];
    capabilityChanges: PolicyPlaceChange[];
    accountsExamined:  number;
}

/** What one *place* would gain or lose — an account, never a person in it. */
export interface PolicyPlaceChange {
    placeId:   string;
    placeName: string;
    scope:     string;
    gains:     string[];
    losses:    string[];
}

export interface PolicyRevisionView {
    version:      number;
    note:         string | null;
    authorEmail:  string | null;
    revertedFrom: number | null;
    roles:        number;
    subjects:     number;
    createdAt:    string;
}

export interface ReadOnlyPolicySource {
    name: string;
    text: string;
    why:  string;
}

export interface PolicyEditorStateView {
    source:          string;
    version:         number;
    mayWrite:        boolean;
    history:         PolicyRevisionView[];
    readOnlySources: ReadOnlyPolicySource[];
}

/**
 * Which reading of the installation's authorization to render as `.jmp`.
 *
 * <p>Three rather than one, because a single merged blob loses the question the editor exists to
 * answer: *which of these may I change*. `policy` is what the files declare, `database` is what the
 * tables hold projected into the same notation, and `effective` is the composite the engine resolves
 * from — editable as policy, as rows, and as neither.
 */
export type PolicyReadingSource = "policy" | "database" | "effective";

/**
 * One reading, as policy source.
 *
 * <p>⚠️ `derived` says the text was **rendered rather than written**: a projection carries no
 * `include`, no comments and no formatting anybody chose, because none of that was ever in a table.
 * Whatever shows it has to say so, or the first person to copy it into a file wonders where their
 * comments went.
 */
export interface PolicyReadingView {
    source:   string;
    derived:  boolean;
    text:     string;
    roles:    number;
    subjects: number;
}

/** Paths are relative to `http`"s `/api` base URL — spelling it again asks for `/api/api/…`. */
export const policyApi = {
    editor: () =>
        http.get<PolicyEditorStateView>("/admin/access/policy/editor"),

    /** Every grant in the installation as `.jmp` — including the ones nobody ever wrote down. */
    reading: (source: PolicyReadingSource) =>
        http.get<PolicyReadingView>("/admin/access/policy", { params: { source } }),

    vocabulary: () =>
        http.get<PolicyVocabularyView>("/admin/access/policy/vocabulary"),

    /** One page of workspaces, accounts or people, matched against what was typed. */
    instances: (kind: PolicyInstanceKind, query: string, page: number) =>
        http.get<PolicyInstancePage>("/admin/access/policy/instances", {
            params: { kind, query, page },
        }),

    validate: (source: string) =>
        http.post<PolicyValidationView>("/admin/access/policy/validate", { source }),

    parse: (source: string) =>
        http.post<PolicyExchangeView>("/admin/access/policy/parse", { source }),

    write: (document: PolicyDocumentView) =>
        http.post<PolicyExchangeView>("/admin/access/policy/write", { document }),

    dryRun: (source: string) =>
        http.post<PolicyDryRunView>("/admin/access/policy/dry-run", { source }),

    save: (source: string, note: string) =>
        http.post<PolicyEditorStateView>("/admin/access/policy/save", { source, note }),

    revert: (version: number) =>
        http.post<PolicyEditorStateView>(`/admin/access/policy/revisions/${version}/revert`),
};
