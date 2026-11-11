import type {
  DocsDocument,
  EmbeddedObject,
  Paragraph,
  Problem,
  ProblemKind,
  StructuralElement,
} from "@/lib/docs/types";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const QUOTE_LENGTH = 60;
const IMAGE_TIMEOUT_MS = 10_000;

/** True for http:, https:, mailto: and tel: addresses; false for anything else or unparseable. */
export function isAllowedHref(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * The paragraphs of the body in document order, table cells included.
 * Tables of contents are skipped: Docs generates them and the site ignores them.
 */
function* paragraphs(content: StructuralElement[]): Generator<Paragraph> {
  for (const element of content) {
    if (element.paragraph) yield element.paragraph;
    for (const row of element.table?.tableRows ?? []) {
      for (const cell of row.tableCells) yield* paragraphs(cell.content);
    }
  }
}

/** A paragraph's visible text, smart-chip titles and date chips included. */
function paragraphText(paragraph: Paragraph): string {
  return paragraph.elements
    .map(
      (e) =>
        e.textRun?.content ??
        e.richLink?.richLinkProperties.title ??
        e.dateElement?.dateElementProperties?.displayText ??
        "",
    )
    .join("");
}

/** Whitespace collapsed, cut to 60 characters. */
function toQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, QUOTE_LENGTH).trim();
}

type ObjectKind = "image" | Extract<ProblemKind, "chart" | "drawing" | "embedded">;

function objectKind(object: EmbeddedObject | undefined): ObjectKind {
  if (object?.embeddedDrawingProperties) return "drawing";
  if (object?.linkedContentReference?.sheetsChartReference) return "chart";
  if (object?.imageProperties && !object.linkedContentReference) return "image";
  return "embedded";
}

function embeddedObject(doc: DocsDocument, id: string): EmbeddedObject | undefined {
  return doc.inlineObjects?.[id]?.inlineObjectProperties.embeddedObject;
}

/** Problems found inside one paragraph, in the order they appear. */
function paragraphProblems(doc: DocsDocument, paragraph: Paragraph): Problem[] {
  const kinds: ProblemKind[] = [];
  if (paragraph.positionedObjectIds?.length) kinds.push("floating-image");
  for (const element of paragraph.elements) {
    if (element.inlineObjectElement) {
      const kind = objectKind(embeddedObject(doc, element.inlineObjectElement.inlineObjectId));
      if (kind !== "image") kinds.push(kind);
    }
    if (element.footnoteReference) kinds.push("footnote");
    if (element.equation) kinds.push("equation");
    const url = element.textRun?.textStyle?.link?.url;
    if (url !== undefined && !isAllowedHref(url)) kinds.push("bad-link");
    if (element.richLink && !isAllowedHref(element.richLink.richLinkProperties.uri ?? "")) {
      kinds.push("bad-link");
    }
  }
  const quote = kinds.length ? toQuote(paragraphText(paragraph)) : "";
  return kinds.map((kind) => ({ kind, quote }));
}

function hasInlineImage(doc: DocsDocument, paragraph: Paragraph): boolean {
  return paragraph.elements.some(
    (e) =>
      e.inlineObjectElement &&
      objectKind(embeddedObject(doc, e.inlineObjectElement.inlineObjectId)) === "image",
  );
}

function isUntitled(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === "" || t === "untitled document";
}

/** Text of a table's first cell. */
function firstCellText(element: StructuralElement): string {
  const cell = element.table?.tableRows[0]?.tableCells[0];
  return cell ? [...paragraphs(cell.content)].map(paragraphText).join(" ") : "";
}

/**
 * Everything in the doc the website can't show. Any problem blocks the doc.
 * Styling, headers, footers, page breaks and similar are ignored.
 */
export function checkStructure(doc: DocsDocument, opts: { requireTitle: boolean }): Problem[] {
  const all = [...paragraphs(doc.body.content)];
  const problems: Problem[] = [];

  const hasText = all.some((p) => paragraphText(p).trim() !== "");
  if (!hasText && !all.some((p) => hasInlineImage(doc, p))) {
    problems.push({ kind: "empty", quote: "" });
  }
  if (opts.requireTitle && isUntitled(doc.title)) problems.push({ kind: "untitled", quote: "" });

  const walk = (content: StructuralElement[]) => {
    for (const element of content) {
      if (element.paragraph) problems.push(...paragraphProblems(doc, element.paragraph));
      if (element.table) {
        problems.push({ kind: "table", quote: toQuote(firstCellText(element)) });
        for (const row of element.table.tableRows) {
          for (const cell of row.tableCells) walk(cell.content);
        }
      }
    }
  };
  walk(doc.body.content);

  return problems;
}

/** Whether a GET of the image succeeds within the time limit. */
async function canFetch(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const ok = res.ok;
    // Only the status matters; a body that fails to cancel is not a broken image.
    await res.body?.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

/** Fetches every inline image the website would show; each one that fails is `image-unfetchable`. */
export async function checkImages(
  doc: DocsDocument,
  fetchImpl: typeof fetch = fetch,
): Promise<Problem[]> {
  const checks: Promise<Problem | null>[] = [];
  for (const paragraph of paragraphs(doc.body.content)) {
    for (const element of paragraph.elements) {
      if (!element.inlineObjectElement) continue;
      const object = embeddedObject(doc, element.inlineObjectElement.inlineObjectId);
      if (objectKind(object) !== "image") continue;

      const uri = object?.imageProperties?.contentUri;
      const quote = toQuote(paragraphText(paragraph));
      checks.push(
        (uri ? canFetch(uri, fetchImpl) : Promise.resolve(false)).then((ok) =>
          ok ? null : { kind: "image-unfetchable", quote },
        ),
      );
    }
  }
  return (await Promise.all(checks)).filter((p): p is Problem => p !== null);
}
