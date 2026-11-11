/**
 * Builders for hand-made Docs API documents, shaped like real `documents.get`
 * responses: the body opens with a section break, each paragraph's last text
 * run ends in "\n", inline objects and positioned objects are registered on
 * the document by ID. Indexes are left out.
 *
 *   doc(para(text("Hello ", { link: "https://x.org" }), inlineImage("kix.1")))
 */
import type {
  DocsDocument,
  EmbeddedObject,
  InlineObject,
  Link,
  List,
  ParagraphElement,
  StructuralElement,
  TextStyle,
} from "@/lib/docs/types";

/** Objects a builder created that `doc()` must register by ID. */
const inlineObjectsOf = new WeakMap<ParagraphElement, InlineObject>();
const positionedObjectsOf = new WeakMap<StructuralElement, Record<string, unknown>>();
const listsOf = new WeakMap<StructuralElement, Record<string, List>>();

export function doc(...elements: StructuralElement[]): DocsDocument {
  const inlineObjects: Record<string, InlineObject> = {};
  const positionedObjects: Record<string, unknown> = {};
  const lists: Record<string, List> = {};

  const collect = (content: StructuralElement[]) => {
    for (const element of content) {
      Object.assign(positionedObjects, positionedObjectsOf.get(element));
      Object.assign(lists, listsOf.get(element));
      for (const run of element.paragraph?.elements ?? []) {
        const object = inlineObjectsOf.get(run);
        if (object) inlineObjects[object.objectId] = object;
      }
      for (const row of element.table?.tableRows ?? []) {
        for (const cell of row.tableCells) collect(cell.content);
      }
    }
  };
  collect(elements);

  const result: DocsDocument = {
    documentId: "test-doc",
    title: "Test page",
    body: { content: [{ sectionBreak: { sectionStyle: {} } }, ...elements] },
  };
  if (Object.keys(inlineObjects).length) result.inlineObjects = inlineObjects;
  if (Object.keys(positionedObjects).length) result.positionedObjects = positionedObjects;
  if (Object.keys(lists).length) result.lists = lists;
  return result;
}

/** A paragraph; a final "\n" is added to its last text run, as the API does. */
export function para(...runs: ParagraphElement[]): StructuralElement {
  const elements = [...runs];
  const last = elements.at(-1);
  if (last?.textRun) {
    elements[elements.length - 1] = {
      ...last,
      textRun: { ...last.textRun, content: (last.textRun.content ?? "") + "\n" },
    };
  } else {
    elements.push({ textRun: { content: "\n", textStyle: {} } });
  }
  return { paragraph: { elements, paragraphStyle: { namedStyleType: "NORMAL_TEXT" } } };
}

/** A paragraph in a named style such as "TITLE" or "HEADING_2". */
export function styled(namedStyleType: string, ...runs: ParagraphElement[]): StructuralElement {
  const element = para(...runs);
  element.paragraph!.paragraphStyle = { namedStyleType };
  return element;
}

/**
 * A list item. Items with the same `listId` (by default one per kind) form one
 * list; `level` is the nesting level, 0 at the outside.
 */
export function listItem(
  { kind, listId = `list.${kind}`, level = 0 }: { kind: "bullet" | "number"; listId?: string; level?: number },
  ...runs: ParagraphElement[]
): StructuralElement {
  const element = para(...runs);
  element.paragraph!.bullet = { listId, ...(level > 0 && { nestingLevel: level }), textStyle: {} };
  const nestingLevel = kind === "number" ? { glyphType: "DECIMAL" } : { glyphSymbol: "●" };
  listsOf.set(element, {
    [listId]: { listProperties: { nestingLevels: Array.from({ length: 9 }, () => nestingLevel) } },
  });
  return element;
}

/**
 * A text run. `link` is a web address, or a full link object such as
 * `{ headingId: "h.abc" }`. `style` adds any other text styling.
 */
export function text(
  s: string,
  { link, style }: { link?: string | Link; style?: TextStyle } = {},
): ParagraphElement {
  const textStyle: TextStyle = { ...style };
  if (link !== undefined) textStyle.link = typeof link === "string" ? { url: link } : link;
  return { textRun: { content: s, textStyle } };
}

/** A table whose rows hold the given cell texts; one empty cell by default. */
export function table(...rows: string[][]): StructuralElement {
  const cellRows = rows.length ? rows : [[""]];
  return {
    table: {
      rows: cellRows.length,
      columns: Math.max(...cellRows.map((r) => r.length)),
      tableRows: cellRows.map((cells) => ({
        tableCells: cells.map((cell) => ({ content: [para(...(cell ? [text(cell)] : []))] })),
      })),
    },
  };
}

function inlineObject(id: string, embeddedObject: EmbeddedObject): ParagraphElement {
  const run: ParagraphElement = { inlineObjectElement: { inlineObjectId: id, textStyle: {} } };
  inlineObjectsOf.set(run, { objectId: id, inlineObjectProperties: { embeddedObject } });
  return run;
}

/** An image placed "In line" with the text; `link` is a web address the image links to. */
export function inlineImage(
  id: string,
  {
    title,
    description,
    contentUri,
    link,
  }: { title?: string; description?: string; contentUri?: string; link?: string } = {},
): ParagraphElement {
  const run = inlineObject(id, {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    imageProperties: { contentUri: contentUri ?? `https://lh7-rt.googleusercontent.com/docsz/${id}` },
  });
  if (link !== undefined) run.inlineObjectElement!.textStyle = { link: { url: link } };
  return run;
}

/** A Google Drawing inserted into the doc. */
export function drawing(id: string): ParagraphElement {
  return inlineObject(id, { embeddedDrawingProperties: {} });
}

/** A chart linked from Google Sheets. */
export function chart(id: string): ParagraphElement {
  return inlineObject(id, {
    imageProperties: { contentUri: `https://lh7-rt.googleusercontent.com/docsz/${id}` },
    linkedContentReference: { sheetsChartReference: { spreadsheetId: "sheet-1", chartId: 1 } },
  });
}

/** An inserted object of a kind the site does not know (neither image, chart nor drawing). */
export function embedded(id: string): ParagraphElement {
  return inlineObject(id, {});
}

export function footnoteRef(): ParagraphElement {
  return { footnoteReference: { footnoteId: "kix.fn1", footnoteNumber: "1" } };
}

export function equation(): ParagraphElement {
  return { equation: {} };
}

/** A Drive smart chip. */
export function richLink(uri: string, title = "Linked file"): ParagraphElement {
  return { richLink: { richLinkId: "kix.rl1", richLinkProperties: { uri, title } } };
}

/** A person chip. */
export function personChip(personProperties: { name?: string; email?: string }): ParagraphElement {
  return { person: { personId: "kix.p1", personProperties } };
}

/** A date chip showing `displayText`, as Docs displays it. */
export function dateChip(displayText: string): ParagraphElement {
  return { dateElement: { dateElementProperties: { displayText } } };
}

export function pageBreak(): ParagraphElement {
  return { pageBreak: {} };
}

/** A paragraph with an image anchored to it and set to wrap or break text. */
export function positioned(id: string, ...runs: ParagraphElement[]): StructuralElement {
  const element = para(...runs);
  element.paragraph!.positionedObjectIds = [id];
  positionedObjectsOf.set(element, {
    [id]: {
      objectId: id,
      positionedObjectProperties: {
        embeddedObject: {
          imageProperties: { contentUri: `https://lh7-rt.googleusercontent.com/docsz/${id}` },
        },
        positioning: { layout: "WRAP_TEXT" },
      },
    },
  });
  return element;
}
