/**
 * The conversation the server hands back, read once and turned into what a screen draws.
 *
 * <p><strong>There is no second copy of the conversation.</strong> The runner is stateless and returns
 * the whole message array, so this file derives everything the transcript shows from that one array —
 * the questions, the answers, which actions ran and what each of them came back with. A parallel list
 * of "things to display", grown alongside it, would be a second history that drifts from the first the
 * moment a turn is retried, and the drift would show as an answer attributed to the wrong question.
 *
 * <p><strong>It is deliberately defensive.</strong> Every block here is a provider's own shape, carried
 * untouched by the library so the round trip survives what it does not understand — which means this
 * file is reading somebody else's JSON and must never throw on a shape it did not expect. Anything
 * unrecognised is skipped, and the worst outcome is a quieter transcript rather than a blank screen.
 */

/** One canonical provider message. Opaque to everything in the application except this file. */
export type AssistantMessage = Record<string, unknown>;

const ROLE_ASSISTANT   = 'assistant';
const ROLE_USER        = 'user';
const TYPE_TEXT        = 'text';
const TYPE_IMAGE       = 'image';
const TYPE_TOOL_USE    = 'tool_use';
const TYPE_TOOL_RESULT = 'tool_result';

/** What the confirmation guard answers with when it has previewed instead of acting. */
const CONFIRMATION_REQUIRED = 'confirmation-required';

/** The argument a confirmed call carries — `ToolInvocation.CONFIRM_ARGUMENT`, server-side. */
export const CONFIRM_ARGUMENT = 'confirm';

/** How a refusal signs itself, so a badge can carry the reason without the sentence repeating it. */
const REFUSAL_TAG = /\s*\[refused:\s*([A-Z_]+)]\s*$/;

/** One row a previewed call would touch. The list is frozen — nothing added later is included. */
export interface AffectedRecord {
    id:    string;
    label: string;
    kind?: string;
}

/**
 * A call that was shown rather than made.
 *
 * <p>The token authorises exactly these records, once, for this caller and this scope — so it is the
 * whole of what a Confirm button needs, and none of it is reconstructible from anywhere else.
 */
export interface ConfirmationPreview {
    token:            string;
    /** Why this one needed confirming — destruction, or simply reach. In the guard's own words. */
    reason:           string;
    count:            number;
    records:          AffectedRecord[];
    expiresInSeconds: number;
    /**
     * Whether a later call in this same conversation already spent it.
     *
     * <p>Answered by looking for the token in a subsequent call's arguments rather than by guessing
     * from position: a preview two turns back that was never confirmed is still perfectly good, and a
     * card that offered to confirm a spent token would fail in a way nobody could act on.
     */
    redeemed:         boolean;
}

/** Where a call resolved to, including whether a default put it there. */
export interface ActedScope {
    kind:       string;
    name:       string;
    wasDefault: boolean;
}

export type ActionOutcome = 'succeeded' | 'refused' | 'previewed' | 'pending';

/** One action the assistant took, with whatever came back from it. */
export interface AssistantAction {
    toolUseId: string;
    name:      string;
    arguments: Record<string, unknown>;
    outcome:   ActionOutcome;
    scope?:    ActedScope;
    /** The refusal as the model received it, minus the machine-readable tag. */
    refusal?:  string;
    /** That tag, as a badge — `NOT_PERMITTED`, `INVALID_CONFIRMATION` and the rest. */
    reason?:   string;
    preview?:  ConfirmationPreview;
    /** What the tool returned, pretty-printed, for the reader who wants to check the working. */
    payload?:  string;
}

/**
 * One thing to draw, in reading order.
 *
 * <p>An assistant turn that both said something and did something produces several of these — the
 * words, then the actions, then any preview — because that is the order it happened in and the order
 * somebody reads it in. A preview is lifted out of the action strip rather than nested in it: it is
 * the one thing on the screen that asks for a decision.
 */
/**
 * A picture in the conversation, ready to put in an `<img src>`.
 *
 * <p>⚠️ **The bytes are already here and are not fetched again.** The canonical block carries the image
 * base64-encoded, because that is what was sent to the model — so the transcript draws exactly what the
 * model was shown, rather than a second copy fetched from the file cabinet that may since have been
 * renamed, made private, or deleted.
 */
export interface TranscriptImage {
    key:      string;
    dataUri:  string;
}

export type TranscriptEntry =
    | { kind: 'question'; key: string; index: number; text: string; images: TranscriptImage[] }
    /** What the last round's tools handed back to look at — see `appendQuestion`. */
    | { kind: 'pictures'; key: string; index: number; images: TranscriptImage[] }
    | { kind: 'answer';   key: string; index: number; text: string }
    | { kind: 'actions';  key: string; index: number; actions: AssistantAction[] }
    | { kind: 'preview';  key: string; index: number; action: string; preview: ConfirmationPreview };

/**
 * The whole conversation, as entries.
 *
 * @param messages exactly what the last answer returned, oldest first
 */
export function buildTranscript(messages: AssistantMessage[]): TranscriptEntry[] {
    const results = indexToolResults(messages);
    const spent   = tokensAlreadySpent(messages);
    const entries: TranscriptEntry[] = [];

    messages.forEach((message, index) => {
        const role = readString(message, 'role');

        if (role === ROLE_USER) {
            appendQuestion(entries, message, index);
            return;
        }

        if (role === ROLE_ASSISTANT) {
            appendAssistantTurn(entries, message, index, results, spent);
        }
    });

    return entries;
}

/** The last preview still worth offering a button for, or nothing. */
export function pendingConfirmation(entries: TranscriptEntry[]): ConfirmationPreview | null {
    for (let position = entries.length - 1; position >= 0; position -= 1) {
        const entry = entries[position];

        if (entry.kind === 'preview' && !entry.preview.redeemed) {
            return entry.preview;
        }
    }

    return null;
}

/**
 * What to send when somebody presses Confirm.
 *
 * <p>Written out in full — the action, the count and the token — rather than left as "yes". The token
 * is already in the transcript the model holds, but naming it removes the one failure this flow can
 * have: a model confirming a *different* pending call, or re-previewing instead of proceeding. And it
 * is shown to the person exactly as it is sent, because a message they cannot see is a message they
 * did not agree to.
 */
export function confirmationInstruction(preview: ConfirmationPreview, action: string): string {
    return `Confirmed — go ahead. Call '${action}' again with the same arguments plus `
         + `${CONFIRM_ARGUMENT}='${preview.token}', affecting only the ${preview.count} `
         + `${preview.count === 1 ? 'record' : 'records'} you listed.`;
}

// ── Building one turn ────────────────────────────────────────────────────────────

/**
 * What somebody said, in either of the two shapes a user message comes in.
 *
 * <p>⚠️ **A user message is one of three things, and only the first two are a question.** Somebody typed
 * it (a plain string); somebody typed it and attached photographs (a block list of images and text); or
 * it is the last round's tool results (a block list of `tool_result`s, with any pictures those tools
 * handed back). The third is read through the calls it answers and never on its own — a wall of JSON in
 * the middle of a conversation is not something anybody asked for.
 *
 * <p>⚠️ **This used to return early on anything that was not a string**, which was right while a question
 * could only ever be one. The moment one could carry a picture, that early return deleted the question
 * itself from the transcript — the words, not just the image.
 */
function appendQuestion(entries: TranscriptEntry[], message: AssistantMessage, index: number): void {
    const content = message.content;

    if (typeof content === 'string') {
        if (content.trim().length > 0) {
            entries.push({ kind: 'question', key: `question-${index}`, index, text: content, images: [] });
        }

        return;
    }

    const blocks = readBlocks(content);

    // The tool-result turn. What the calls said is read through the actions above it — but a picture one
    // of them handed back has nowhere else to be drawn, so it gets a strip of its own.
    //
    // ⚠️ Drawn as *the round's* pictures rather than attributed to a particular action. They arrive as
    // siblings of the results rather than inside one, so which call produced which is not something this
    // can know — and a photograph shown under the wrong action is worse than one shown under none.
    if (blocks.some((block) => readString(block, 'type') === TYPE_TOOL_RESULT)) {
        const returned = readImages(blocks, `pictures-${index}`);

        if (returned.length > 0) {
            entries.push({ kind: 'pictures', key: `pictures-${index}`, index, images: returned });
        }

        return;
    }

    const text = blocks
        .filter((block) => readString(block, 'type') === TYPE_TEXT)
        .map((block) => readString(block, 'text') ?? '')
        .filter((said) => said.trim().length > 0)
        .join('\n\n');

    const images = readImages(blocks, `question-${index}`);

    if (text.length === 0 && images.length === 0) {
        return;
    }

    entries.push({ kind: 'question', key: `question-${index}`, index, text, images });
}

/**
 * The pictures among a set of blocks, as addresses a browser can draw.
 *
 * <p>Defensive like everything else here: a block whose source this cannot read is skipped rather than
 * drawn as a broken image, because the worst outcome of reading somebody else's JSON must be a quieter
 * transcript and never a broken screen.
 */
function readImages(blocks: Record<string, unknown>[], keyPrefix: string): TranscriptImage[] {
    return blocks
        .filter((block) => readString(block, 'type') === TYPE_IMAGE)
        .map((block, position) => {
            const source = isRecord(block.source) ? block.source : {};
            const type   = readString(source, 'media_type');
            const data   = readString(source, 'data');

            if (!type || !data) {
                return undefined;
            }

            return { key: `${keyPrefix}-image-${position}`, dataUri: `data:${type};base64,${data}` };
        })
        .filter((image): image is TranscriptImage => image !== undefined);
}

function appendAssistantTurn(
    entries:  TranscriptEntry[],
    message:  AssistantMessage,
    index:    number,
    results:  Map<string, ToolResult>,
    spent:    Set<string>,
): void {
    const blocks = readBlocks(message.content);
    const said   = blocks
        .filter((block) => readString(block, 'type') === TYPE_TEXT)
        .map((block) => readString(block, 'text') ?? '')
        .filter((text) => text.trim().length > 0)
        .join('\n\n');

    if (said.length > 0) {
        entries.push({ kind: 'answer', key: `answer-${index}`, index, text: said });
    }

    const actions = blocks
        .filter((block) => readString(block, 'type') === TYPE_TOOL_USE)
        .map((block) => resolveAction(block, results, spent));

    if (actions.length === 0) {
        return;
    }

    entries.push({ kind: 'actions', key: `actions-${index}`, index, actions });

    actions.forEach((action) => {
        if (action.preview) {
            entries.push({
                kind:    'preview',
                key:     `preview-${action.toolUseId}`,
                index,
                action:  action.name,
                preview: action.preview,
            });
        }
    });
}

function resolveAction(
    block:   Record<string, unknown>,
    results: Map<string, ToolResult>,
    spent:   Set<string>,
): AssistantAction {
    const toolUseId = readString(block, 'id') ?? '';
    const name      = readString(block, 'name') ?? 'unknown';
    const input     = isRecord(block.input) ? block.input : {};
    const result    = results.get(toolUseId);

    if (!result) {
        // The loop stopped between asking for a call and answering it — a budget ran out mid-round.
        // Saying so is the point: the alternative is an action strip that looks like it succeeded.
        return { toolUseId, name, arguments: input, outcome: 'pending' };
    }

    const preview = result.preview
        ? { ...result.preview, redeemed: spent.has(result.preview.token) }
        : undefined;

    return {
        toolUseId,
        name,
        arguments: input,
        outcome:   outcomeOf(result, preview),
        scope:     result.scope,
        refusal:   result.refusal,
        reason:    result.reason,
        preview,
        payload:   result.payload,
    };
}

function outcomeOf(result: ToolResult, preview: ConfirmationPreview | undefined): ActionOutcome {
    if (result.refusal) {
        return 'refused';
    }

    return preview ? 'previewed' : 'succeeded';
}

// ── Reading what came back ───────────────────────────────────────────────────────

interface ToolResult {
    scope?:   ActedScope;
    preview?: ConfirmationPreview;
    refusal?: string;
    reason?:  string;
    payload?: string;
}

/**
 * Every tool result in the conversation, by the call it answers.
 *
 * <p>Indexed in one pass ahead of the walk because a result always arrives in the message *after* the
 * call it belongs to — reading forwards while drawing would mean drawing an action before knowing how
 * it went, and re-rendering it a moment later.
 */
function indexToolResults(messages: AssistantMessage[]): Map<string, ToolResult> {
    const results = new Map<string, ToolResult>();

    messages.forEach((message) => {
        if (readString(message, 'role') !== ROLE_USER) {
            return;
        }

        readBlocks(message.content)
            .filter((block) => readString(block, 'type') === TYPE_TOOL_RESULT)
            .forEach((block) => {
                const toolUseId = readString(block, 'tool_use_id');

                if (toolUseId) {
                    results.set(toolUseId, readToolResult(block));
                }
            });
    });

    return results;
}

function readToolResult(block: Record<string, unknown>): ToolResult {
    const content = typeof block.content === 'string' ? block.content : '';

    if (block.is_error === true) {
        const tagged = REFUSAL_TAG.exec(content);

        return {
            refusal: tagged ? content.replace(REFUSAL_TAG, '') : content,
            reason:  tagged ? tagged[1] : undefined,
        };
    }

    const body = parseJson(content);

    if (!isRecord(body)) {
        // A handler whose return value could not be written as JSON says so in plain words. Showing
        // that sentence beats showing nothing, and it is not an error the model could have avoided.
        return { payload: content };
    }

    return {
        scope:   readScope(body.scope),
        preview: readPreview(body.result),
        payload: describePayload(body.result),
    };
}

function readScope(value: unknown): ActedScope | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const kind = readString(value, 'kind');
    const name = readString(value, 'name');

    if (!kind || !name) {
        return undefined;
    }

    return { kind, name, wasDefault: value.wasDefault === true };
}

function readPreview(value: unknown): ConfirmationPreview | undefined {
    if (!isRecord(value) || value.status !== CONFIRMATION_REQUIRED) {
        return undefined;
    }

    const token = readString(value, CONFIRM_ARGUMENT);

    if (!token) {
        return undefined;
    }

    return {
        token,
        reason:           readString(value, 'reason') ?? '',
        count:            typeof value.affectedCount === 'number' ? value.affectedCount : 0,
        records:          readRecords(value.affected),
        expiresInSeconds: typeof value.expiresInSeconds === 'number' ? value.expiresInSeconds : 0,
        // Filled in by the caller, which can see the whole conversation. Nothing here can.
        redeemed:         false,
    };
}

function readRecords(value: unknown): AffectedRecord[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isRecord).map((record) => ({
        id:    readString(record, 'id') ?? '',
        label: readString(record, 'label') ?? readString(record, 'id') ?? '',
        kind:  readString(record, 'kind'),
    }));
}

/**
 * A preview is drawn as itself, so it is not repeated as raw JSON underneath the card. Everything
 * else is offered as the reader last resort — folded away, and never the primary rendering.
 */
function describePayload(value: unknown): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (isRecord(value) && value.status === CONFIRMATION_REQUIRED) {
        return undefined;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return undefined;
    }
}

/** Every confirmation token this conversation has already handed back to a call. */
function tokensAlreadySpent(messages: AssistantMessage[]): Set<string> {
    const spent = new Set<string>();

    messages.forEach((message) => {
        if (readString(message, 'role') !== ROLE_ASSISTANT) {
            return;
        }

        readBlocks(message.content)
            .filter((block) => readString(block, 'type') === TYPE_TOOL_USE)
            .forEach((block) => {
                const token = isRecord(block.input) ? readString(block.input, CONFIRM_ARGUMENT) : undefined;

                if (token) {
                    spent.add(token);
                }
            });
    });

    return spent;
}

// ── Reading somebody else's JSON without trusting it ─────────────────────────────

function readBlocks(content: unknown): Record<string, unknown>[] {
    return Array.isArray(content) ? content.filter(isRecord) : [];
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];

    return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}
