/**
 * The types the skeleton needs and nothing more.
 *
 * ⚠️ The old `UI/src/types/index.ts` is ~1400 lines describing every domain in the product. It is not
 * ported wholesale: each domain brings its own types along with the screens that read them, so a type
 * arrives with something that uses it rather than as a manifest of work not yet done.
 */
import type { AvatarView } from "@/api/avatars"

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  provider: "LOCAL" | "GOOGLE" | "GITHUB"
  roles: string[]
  /**
   * What this account may do **somewhere** — the coarse set.
   *
   * Right for offering an action that exists in some workspace; wrong for anything about the
   * installation, because every ordinary user holds `space:read` in the workspaces they belong to.
   */
  permissions: string[]
  /**
   * What this account may do **everywhere** — resolved at `GLOBAL`. Platform-level menu items are
   * gated on this one.
   */
  installationPermissions: string[]
  preferences: Record<string, string>
  /**
   * What this account's face is, and how to draw it.
   *
   * ⚠️ **A shape rather than a URL.** There used to be one stable address the server
   * answered for everybody. There is no server-drawn face any more: read `kind` and draw initials, a
   * pixel face from `preset`, or the picture at `url`. See `@/api/avatars`.
   */
  avatar: AvatarView
  /**
   * Where this account’s own file cabinet is.
   *
   * ⚠️ **Answered by the profile rather than discovered.** A tree comes into existence when somebody
   * first needs it, so listing the roots to find one would be told there are none — and asking for the
   * profile is what makes it exist.
   */
  filesRootId: string
  twoFactorEnabled: boolean
  enabled: boolean
}

export interface TokenPairResponse {
  accessToken: string
  refreshToken: string
}

/**
 * What a sign-in answers with. ⚠️ A second factor turns the answer into `pendingToken` alone — no
 * access token is issued until the code is confirmed, which is why these three are all optional.
 */
export interface LoginResponse {
  accessToken?: string
  refreshToken?: string
  pendingToken?: string
  user?: UserProfile
}

export interface MessageResponse {
  message: string
}

export interface SpaceSummary {
  id: string
  name: string
  slug: string
  description: string | null
  memberCount: number
  discoverable: boolean
  createdAt: string
}

/**
 * ⚠️ Three standings, not a `permitted` boolean beside them. Two spellings of one fact is one too
 * many, and the day they disagree the menu is drawn from whichever is wrong.
 */
export type NavigationStanding = "PERMITTED" | "NO_PERMISSION" | "NOT_IN_PLAN"

/** One entry of the workspace menu, as the backend hands it over — filtered, and annotated. */
export interface SpaceNavigationItem {
  key: string
  /** Relative to the workspace's own root; `spaceSectionPath` makes it an address. */
  path: string
  label: string
  icon: string
  /** The workspace locked this module on, so a personal tidy-up cannot take it away. */
  pinned: boolean
  standing: NavigationStanding
  /** What to tell whoever cannot open it, in the refusing axis's own words. Null where they can. */
  words: string | null
}

/** A group of entries, named by whoever contributed it — an area that supplies sections names them. */
export interface SpaceNavigationSection {
  key: string
  label: string
  items: SpaceNavigationItem[]
}

/** One purpose's second face: the section it is seen on, and what the door to it says. */
export interface SpacePresentation {
  section: string
  label: string
}

export interface SpaceNavigation {
  sections: SpaceNavigationSection[]
  /**
   * Where a form of a given purpose is seen as a *domain object*, keyed by purpose code.
   *
   * ⚠️ **A list, because one purpose has more than one face.** A form describing stock is a component
   * type on one screen and the stock counted against it on another; a form describing a thing is on the
   * assets board and is also the class a watch is configured against.
   *
   * ⚠️ **Served rather than compiled into a screen.** The form library is the low level — a form is a
   * schema there, and it is the same screen whatever the workspace is about. It used to hold a map
   * naming the component-types section, its route and the words "component type", which is L1 knowing
   * what a component is. The subject area declares this now; the library renders what it
   * is handed and knows no nouns.
   */
  presentations: Record<string, SpacePresentation[]>
}

export * from "./forms"

/** What a template is about. A place has no form, so it never carries a binding. */
/**
 * What a design is about.
 *
 * Two, and they differ by four facts: an asset carries a state, a holder, a place and a due date
 * that an entry has nowhere to keep. There was a `LOCATION` kind and it is gone — a design lays out
 * a *form's* fields, and a place has no form.
 */
export type LabelSubjectKind = 'ENTRY' | 'ASSET';

export type LabelElementType = 'TEXT' | 'QR' | 'BARCODE' | 'IMAGE' | 'BOX' | 'LINE';

/** What an element does when the real value is longer than the box drawn for it. */
export type LabelOverflow = 'CLIP' | 'SHRINK' | 'WRAP';

export type LabelAlignment = 'LEFT' | 'CENTER' | 'RIGHT';

export type BarcodeSymbology = 'CODE_128' | 'CODE_39' | 'EAN_13' | 'ITF';

/** How much of a QR may be lost and still read. Higher survives a scuffed sticker; it costs density. */
export type QrErrorCorrection = 'LOW' | 'MEDIUM' | 'QUARTILE' | 'HIGH';

export type LabelImageFit = 'CONTAIN' | 'COVER' | 'FILL';

/** Below this a code does not survive a thermal printer and a phone camera. The studio refuses it. */
export const MINIMUM_CODE_SIDE_MM = 8;

/** Where an element sits and how big it is — millimetres from the top-left corner, always. */
export interface LabelGeometry {
    x:        number;
    y:        number;
    width:    number;
    height:   number;
    /** Whole quarter turns: a sticker is applied one of four ways up. */
    rotation: number;
}

export interface LabelTextStyle {
    fontSizeMm: number;
    bold:       boolean;
    align:      LabelAlignment;
    overflow:   LabelOverflow;
}

export interface LabelCodeStyle {
    symbology:       BarcodeSymbology;
    errorCorrection: QrErrorCorrection;
    /** The blank border, in modules rather than millimetres — the unit every encoder states it in. */
    quietZone:       number;
}

export interface LabelImageStyle {
    fit: LabelImageFit;
}

export interface LabelStrokeStyle {
    thicknessMm: number;
    /** A frame's inside, painted or not. Meaningless to a line. */
    filled:      boolean;
}

/**
 * One rectangle on a label.
 *
 * `content` is a jME template whatever the type — a text box carries `Інв. № {{ inventory_number }}`,
 * a QR carries `{{ id }}`, a picture carries a file token. What differs is only how the resolved
 * string is drawn.
 *
 * Each type carries its own style and nothing else's, so the property panel shows what an element
 * actually has rather than a form full of controls that do nothing for the thing selected.
 */
export interface LabelElement {
    id:       string;
    type:     LabelElementType;
    geometry: LabelGeometry;
    content:  string;
    text:     LabelTextStyle   | null;
    code:     LabelCodeStyle   | null;
    image:    LabelImageStyle  | null;
    stroke:   LabelStrokeStyle | null;
}

/** A row of the template list: what it is called, and what it is for. */
export interface LabelTemplateSummary {
    id:           string;
    name:         string;
    subjectKind:  LabelSubjectKind;
    /** The form whose fields this design lays out. Never null. */
    formId:       string;
    /**
     * Whether this reader owns it.
     *
     * A design somebody else shared into the workspace is theirs to change and this reader's to
     * print from — so the list shows it and offers Duplicate rather than Edit.
     */
    mine:         boolean;
    widthMm:      number;
    heightMm:     number;
    elementCount: number;
    createdAt:    string;
    updatedAt:    string;
}

export interface LabelTemplateDetail extends Omit<LabelTemplateSummary, 'elementCount'> {
    elements: LabelElement[];
}

/** What the studio saves. `elements` is omitted only when creating — the server composes a starter. */
export interface SaveLabelTemplatePayload {
    name:        string;
    subjectKind: LabelSubjectKind;
    /** Required — a design lays out one form's fields, and picking it is the first thing you do. */
    formId:      string;
    widthMm:     number;
    heightMm:    number;
    elements?:   LabelElement[];
}

/**
 * One thing a template may put on a label.
 *
 * `example` is what a canvas shows before a real record is chosen — never what is printed.
 */
export interface LabelPlaceholder {
    key:     string;
    label:   string;
    example: string;
}

/** A kind of record this installation can label, and what one always has. */
export interface LabelSubjectDescriptor {
    kind:       LabelSubjectKind;
    structural: LabelPlaceholder[];
}

/**
 * One record's resolved content, keyed by the element it belongs in.
 *
 * `failures` rather than an error, because one bad expression must not stop thirty-nine good labels.
 * `codes` carries the code elements already drawn as `data:` URIs — embedded rather than linked so
 * the screen, the printer and the PNG export are one document.
 */
export interface ResolvedLabelRecord {
    id:       string;
    elements: Record<string, string>;
    codes:    Record<string, string>;
    failures: Record<string, string>;
}

/** A real record a template could be about — what the studio previews against. */
export interface LabelRecordChoice {
    id:    string;
    label: string;
}
