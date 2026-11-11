/**
 * The parts of a Google Docs API `documents` resource the site reads, typed
 * from https://developers.google.com/docs/api/reference/rest/v1/documents.
 * Fields the site never reads are left out; every field is as the API names it.
 */

export type DocsDocument = {
  documentId: string;
  title: string;
  body: { content: StructuralElement[] };
  inlineObjects?: Record<string, InlineObject>;
  positionedObjects?: Record<string, unknown>;
  lists?: Record<string, unknown>;
};

/** One block of the body: exactly one of the content fields is set. */
export type StructuralElement = {
  startIndex?: number;
  endIndex?: number;
  paragraph?: Paragraph;
  sectionBreak?: Record<string, unknown>;
  table?: Table;
  tableOfContents?: { content?: StructuralElement[] };
};

export type Paragraph = {
  elements: ParagraphElement[];
  paragraphStyle?: ParagraphStyle;
  bullet?: { listId?: string; nestingLevel?: number; textStyle?: TextStyle };
  /** Images anchored to this paragraph and set to wrap or break text. */
  positionedObjectIds?: string[];
};

export type ParagraphStyle = {
  namedStyleType?: string;
  headingId?: string;
  alignment?: string;
  [field: string]: unknown;
};

/** One run inside a paragraph: exactly one of the content fields is set. */
export type ParagraphElement = {
  startIndex?: number;
  endIndex?: number;
  textRun?: TextRun;
  autoText?: Record<string, unknown>;
  pageBreak?: Record<string, unknown>;
  columnBreak?: Record<string, unknown>;
  footnoteReference?: { footnoteId?: string; footnoteNumber?: string };
  horizontalRule?: Record<string, unknown>;
  equation?: Record<string, unknown>;
  inlineObjectElement?: { inlineObjectId: string; textStyle?: TextStyle };
  person?: { personId?: string; personProperties?: { name?: string; email?: string } };
  richLink?: RichLink;
  dateElement?: Record<string, unknown>;
};

/** The last run of a paragraph ends with "\n". */
export type TextRun = { content: string; textStyle?: TextStyle };

export type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: Link;
  [field: string]: unknown;
};

/** A link to a web address, or to a heading or bookmark in the same doc. */
export type Link = {
  url?: string;
  headingId?: string;
  bookmarkId?: string;
  heading?: { id: string; tabId?: string };
  bookmark?: { id: string; tabId?: string };
  tabId?: string;
};

/** A smart chip linking to a Google resource such as a Drive file. */
export type RichLink = {
  richLinkId?: string;
  richLinkProperties: { uri: string; title?: string; mimeType?: string };
  textStyle?: TextStyle;
};

export type Table = {
  rows: number;
  columns: number;
  tableRows: { tableCells: { content: StructuralElement[] }[] }[];
};

export type InlineObject = {
  objectId: string;
  inlineObjectProperties: { embeddedObject: EmbeddedObject };
};

export type EmbeddedObject = {
  title?: string;
  description?: string;
  imageProperties?: { contentUri?: string; sourceUri?: string };
  embeddedDrawingProperties?: Record<string, unknown>;
  linkedContentReference?: {
    sheetsChartReference?: { spreadsheetId: string; chartId: number };
  };
};

export type ProblemKind =
  | "empty"
  | "untitled"
  | "table"
  | "drawing"
  | "chart"
  | "equation"
  | "footnote"
  | "embedded"
  | "floating-image"
  | "image-unfetchable"
  | "bad-link";

export type Problem = { kind: ProblemKind; quote: string };
