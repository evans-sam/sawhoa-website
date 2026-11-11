/**
 * Turns a Google Docs API document into an HTML tree (hast) that carries the
 * doc's structure and none of its styling: headings, paragraphs, lists, bold,
 * italic, strikethrough, links and inline images. The site's own CSS styles it.
 *
 * Written from `doc.body.content` directly rather than with
 * @googleworkspace/google-docs-hast, which emits inline styles, `<i>`, person
 * `mailto:` links and console warnings, and throws on missing objects.
 */
import type { Element, ElementContent, Root } from "hast";
import { embeddedObject, isAllowedHref, objectKind } from "@/lib/docs/check";
import type { DocsDocument, Paragraph, ParagraphElement, TextStyle } from "@/lib/docs/types";

export type Converted = { tree: Root; excerpt: string };

export type ConvertOptions = {
  /** Drive links to these file IDs become /files/<id>. */
  servablePdfIds: Set<string>;
  /** Each doc "Heading 3" and the content up to the next heading becomes a <details>. */
  faq?: boolean;
};

/** Pages keep the site's single <h1>, so each doc heading moves down one level. */
const HEADING_TAGS = new Map([
  ["HEADING_1", "h2"],
  ["HEADING_2", "h3"],
  ["HEADING_3", "h4"],
  ["HEADING_4", "h5"],
  ["HEADING_5", "h6"],
  ["HEADING_6", "h6"],
]);
const HEADINGS = new Set(HEADING_TAGS.values());
/** A doc "Heading 3", after the shift. */
const FAQ_QUESTION_TAG = "h4";
const UNORDERED_GLYPHS = new Set([undefined, "GLYPH_TYPE_UNSPECIFIED", "NONE"]);
const EXCERPT_LENGTH = 280;
/** Docs' soft line break (Shift+Enter). */
const LINE_BREAK = "\u000b";

function el(tagName: string, properties: Element["properties"] = {}, children: ElementContent[] = []): Element {
  return { type: "element", tagName, properties, children };
}

/** Plain text of nodes; a line break counts as a space. */
function plainText(nodes: ElementContent[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      if (n.type !== "element") return "";
      return n.tagName === "br" ? " " : plainText(n.children);
    })
    .join("");
}

function hasImage(nodes: ElementContent[]): boolean {
  return nodes.some(
    (n) => n.type === "element" && (n.tagName === "img" || hasImage(n.children)),
  );
}

/** The ID in a https://drive.google.com/file/d/<id>/… address. */
function driveFileId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname !== "drive.google.com") return undefined;
    return /^\/file\/d\/([^/]+)/.exec(u.pathname)?.[1];
  } catch {
    return undefined;
  }
}

/** Where a doc link should go on the site, or nothing when it must not be a link. */
function resolveHref(url: string | undefined, opts: ConvertOptions): string | undefined {
  if (url === undefined) return undefined;
  const fileId = driveFileId(url);
  if (fileId && opts.servablePdfIds.has(fileId)) return `/files/${encodeURIComponent(fileId)}`;
  return isAllowedHref(url) ? url : undefined;
}

function anchor(href: string, children: ElementContent[]): Element {
  const external = /^https?:/i.test(href);
  return el("a", external ? { href, rel: ["noopener"] } : { href }, children);
}

/** Text with soft line breaks turned into <br>; the paragraph's closing "\n" removed. */
function textNodes(content: string): ElementContent[] {
  const nodes: ElementContent[] = [];
  content
    .replace(/\n/g, "")
    .split(LINE_BREAK)
    .forEach((part, i) => {
      if (i > 0) nodes.push(el("br"));
      if (part) nodes.push({ type: "text", value: part });
    });
  return nodes;
}

/** Nodes wrapped in the run's bold, italic and strikethrough; no text gets no wrapper. */
function withTextStyle(nodes: ElementContent[], style: TextStyle | undefined): ElementContent[] {
  if (!nodes.length) return nodes;
  let result = nodes;
  if (style?.strikethrough) result = [el("s", {}, result)];
  if (style?.italic) result = [el("em", {}, result)];
  if (style?.bold) result = [el("strong", {}, result)];
  return result;
}

/** One paragraph element's output, and where it links to. */
type Piece = { nodes: ElementContent[]; href?: string };

function piece(doc: DocsDocument, element: ParagraphElement, opts: ConvertOptions): Piece {
  const { textRun, inlineObjectElement, richLink, person, dateElement } = element;
  if (textRun) {
    const style = textRun.textStyle;
    return {
      nodes: withTextStyle(textNodes(textRun.content ?? ""), style),
      href: resolveHref(style?.link?.url, opts),
    };
  }
  if (inlineObjectElement) {
    const id = inlineObjectElement.inlineObjectId;
    const object = embeddedObject(doc, id);
    if (objectKind(object) !== "image") return { nodes: [] };
    const src = `/media/${encodeURIComponent(doc.documentId)}/${encodeURIComponent(id)}`;
    const alt = object?.description || object?.title || "";
    return {
      nodes: [el("img", { src, alt, loading: "lazy" })],
      href: resolveHref(inlineObjectElement.textStyle?.link?.url, opts),
    };
  }
  if (richLink) {
    const { uri, title } = richLink.richLinkProperties ?? {};
    return { nodes: textNodes(title ?? uri ?? ""), href: resolveHref(uri, opts) };
  }
  if (person) {
    const { name, email } = person.personProperties ?? {};
    return { nodes: textNodes(name ?? email ?? "") };
  }
  if (dateElement) {
    return { nodes: textNodes(dateElement.dateElementProperties?.displayText ?? "") };
  }
  // Footnotes, equations, page breaks, horizontal rules and the like are not shown.
  return { nodes: [] };
}

/** A paragraph's inline content; neighbouring runs with the same link share one <a>. */
function inlineContent(doc: DocsDocument, paragraph: Paragraph, opts: ConvertOptions): ElementContent[] {
  const out: ElementContent[] = [];
  let open: Element | undefined;
  for (const element of paragraph.elements ?? []) {
    const { nodes, href } = piece(doc, element, opts);
    if (!nodes.length) continue;
    if (href === undefined) {
      open = undefined;
      out.push(...nodes);
    } else if (open && open.properties.href === href) {
      open.children.push(...nodes);
    } else {
      open = anchor(href, nodes);
      out.push(open);
    }
  }
  return out;
}

function listTag(doc: DocsDocument, listId: string, level: number): "ol" | "ul" {
  const glyphType = doc.lists?.[listId]?.listProperties?.nestingLevels?.[level]?.glyphType;
  return UNORDERED_GLYPHS.has(glyphType) ? "ul" : "ol";
}

/** The body's blocks: headings, paragraphs and lists, in order. */
function blocks(doc: DocsDocument, opts: ConvertOptions): Element[] {
  const out: Element[] = [];
  /** The lists the next item may join, outermost first. */
  let openLists: { level: number; list: Element }[] = [];
  let openListId: string | undefined;
  /** Outer items already shown per list, so a numbered list split by a paragraph keeps counting. */
  const itemsShown = new Map<string, number>();

  for (const element of doc.body.content) {
    const paragraph = element.paragraph;
    const style = paragraph?.paragraphStyle?.namedStyleType;
    if (!paragraph || style === "TITLE") {
      // Section breaks, tables, tables of contents and the title are not shown.
      openLists = [];
      continue;
    }

    const children = inlineContent(doc, paragraph, opts);
    if (!hasImage(children) && plainText(children).trim() === "") continue;

    if (!paragraph.bullet) {
      openLists = [];
      out.push(el(HEADING_TAGS.get(style ?? "") ?? "p", {}, children));
      continue;
    }

    const listId = paragraph.bullet.listId ?? "";
    const level = paragraph.bullet.nestingLevel ?? 0;
    if (listId !== openListId) openLists = [];
    while (openLists.length && openLists[openLists.length - 1].level > level) openLists.pop();

    const innermost = openLists.at(-1);
    if (!innermost || innermost.level < level) {
      const tag = listTag(doc, listId, level);
      const list = el(tag);
      if (innermost) {
        const lastItem = innermost.list.children.at(-1) as Element;
        lastItem.children.push(list);
      } else {
        const shown = itemsShown.get(listId) ?? 0;
        if (tag === "ol" && shown > 0) list.properties.start = shown + 1;
        out.push(list);
      }
      openLists.push({ level, list });
      openListId = listId;
    }
    if (openLists.length === 1) itemsShown.set(listId, (itemsShown.get(listId) ?? 0) + 1);
    openLists[openLists.length - 1].list.children.push(el("li", {}, children));
  }
  return out;
}

/** Each question heading and the blocks up to the next heading become one <details>. */
function groupFaq(input: Element[]): Element[] {
  const out: Element[] = [];
  let answer: Element | undefined;
  for (const block of input) {
    if (HEADINGS.has(block.tagName)) {
      answer = undefined;
      if (block.tagName === FAQ_QUESTION_TAG) {
        answer = el("details", {}, [el("summary", {}, block.children)]);
        out.push(answer);
        continue;
      }
    }
    if (answer) answer.children.push(block);
    else out.push(block);
  }
  return out;
}

/** Whitespace collapsed; over 280 characters, cut at the last word boundary and "…" added. */
function toExcerpt(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= EXCERPT_LENGTH) return t;
  const head = t.slice(0, EXCERPT_LENGTH);
  const lastSpace = head.lastIndexOf(" ");
  const cut = t[EXCERPT_LENGTH] === " " || lastSpace <= 0 ? head : head.slice(0, lastSpace);
  return cut.trimEnd() + "…";
}

/**
 * The doc's first tab as an HTML tree, and the first paragraph's text as an
 * excerpt. Content the checker blocks (tables, drawings, footnotes and so on)
 * is dropped, and no link outside http:, https:, mailto: and tel: is kept.
 */
export function convertDoc(doc: DocsDocument, opts: ConvertOptions): Converted {
  const body = blocks(doc, opts);
  const first = body.find((b) => b.tagName === "p" && plainText(b.children).trim() !== "");
  return {
    tree: { type: "root", children: opts.faq ? groupFaq(body) : body },
    excerpt: first ? toExcerpt(plainText(first.children)) : "",
  };
}
