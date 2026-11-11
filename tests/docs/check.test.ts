import { describe, expect, test, vi } from "vitest";
import { checkImages, checkStructure, isAllowedHref } from "@/lib/docs/check";
import { commentText } from "@/lib/docs/messages";
import type { DocsDocument, ProblemKind, StructuralElement } from "@/lib/docs/types";
import {
  chart,
  dateChip,
  doc,
  drawing,
  embedded,
  equation,
  footnoteRef,
  inlineImage,
  pageBreak,
  para,
  positioned,
  richLink,
  table,
  text,
} from "./builders";

const opts = { requireTitle: false };

function check(...elements: StructuralElement[]) {
  return checkStructure(doc(...elements), opts);
}

function titled(title: string): DocsDocument {
  return { ...doc(para(text("Hello"))), title };
}

describe("checkStructure", () => {
  test("styling, alignment and page breaks are fine", () => {
    const centred = para(
      text("Big purple ", {
        style: {
          fontSize: { magnitude: 24, unit: "PT" },
          foregroundColor: { color: { rgbColor: { red: 0.5, blue: 0.5 } } },
        },
      }),
      text("bold", { style: { bold: true } }),
      pageBreak(),
    );
    centred.paragraph!.paragraphStyle = { namedStyleType: "NORMAL_TEXT", alignment: "CENTER" };

    expect(check(centred, para(text("After the break")))).toEqual([]);
  });

  test("a doc with only whitespace is empty", () => {
    expect(check(para(text("  \t ")), para())).toEqual([{ kind: "empty", quote: "" }]);
  });

  test("a doc with only an inline image is not empty", () => {
    expect(check(para(inlineImage("kix.img1")))).toEqual([]);
  });

  test("a doc with only a date chip is not empty, and the chip is quoted", () => {
    expect(check(para(dateChip("Nov 11, 2026")))).toEqual([]);
    expect(check(para(text("Meeting on "), dateChip("Nov 11, 2026"), equation()))).toEqual([
      { kind: "equation", quote: "Meeting on Nov 11, 2026" },
    ]);
  });

  test("an inline object missing from the doc's inlineObjects is embedded", () => {
    const d = doc(para(text("See "), { inlineObjectElement: { inlineObjectId: "kix.gone" } }));
    expect(checkStructure(d, opts)).toEqual([{ kind: "embedded", quote: "See" }]);
  });

  test("an image with a link to something other than a Sheets chart is embedded", () => {
    const d = doc(para(text("Slide "), inlineImage("kix.s1")));
    d.inlineObjects!["kix.s1"].inlineObjectProperties.embeddedObject.linkedContentReference = {};
    expect(checkStructure(d, opts)).toEqual([{ kind: "embedded", quote: "Slide" }]);
  });

  describe("title", () => {
    test.each(["", "   ", "Untitled document", "untitled DOCUMENT"])(
      "%j is untitled when a title is required",
      (title) => {
        expect(checkStructure(titled(title), { requireTitle: true })).toEqual([
          { kind: "untitled", quote: "" },
        ]);
      },
    );

    test("a blank title is fine when no title is required", () => {
      expect(checkStructure(titled(""), { requireTitle: false })).toEqual([]);
    });

    test("a real title is fine", () => {
      expect(checkStructure(titled("Pool opening"), { requireTitle: true })).toEqual([]);
    });
  });

  test("a table is quoted by its first cell", () => {
    const longCell = "Trash pickup ".repeat(10);
    expect(check(para(text("Intro")), table([longCell, "Monday"]))).toEqual([
      { kind: "table", quote: longCell.slice(0, 60) },
    ]);
  });

  test("two tables give two problems with different quotes", () => {
    expect(check(table(["Trash pickup", "Mon"]), table(["Recycling", "Thu"]))).toEqual([
      { kind: "table", quote: "Trash pickup" },
      { kind: "table", quote: "Recycling" },
    ]);
  });

  test("a table with an empty first cell has an empty quote", () => {
    expect(check(para(text("Intro")), table())).toEqual([{ kind: "table", quote: "" }]);
  });

  test.each<[ProblemKind, ReturnType<typeof drawing>]>([
    ["drawing", drawing("kix.d1")],
    ["chart", chart("kix.c1")],
    ["embedded", embedded("kix.e1")],
    ["footnote", footnoteRef()],
    ["equation", equation()],
  ])("%s is a problem quoted by its paragraph", (kind, element) => {
    expect(check(para(text("Budget for 2027 "), element, text(" in detail")))).toEqual([
      { kind, quote: "Budget for 2027 in detail" },
    ]);
  });

  test("a paragraph-level problem in an untexted paragraph has an empty quote", () => {
    expect(check(para(text("Intro")), para(drawing("kix.d1")))).toEqual([
      { kind: "drawing", quote: "" },
    ]);
  });

  test("a paragraph quote is cut to 60 characters", () => {
    const long = "word ".repeat(30);
    const [problem] = check(para(text(long), equation()));
    expect(problem.quote).toBe(long.slice(0, 60).trim());
  });

  test("an image set to wrap text is a floating image", () => {
    expect(check(positioned("kix.p1", text("Pool rules")))).toEqual([
      { kind: "floating-image", quote: "Pool rules" },
    ]);
  });

  test("an empty positionedObjectIds list is fine", () => {
    const p = para(text("Pool rules"));
    p.paragraph!.positionedObjectIds = [];
    expect(check(p)).toEqual([]);
  });

  test("problems inside table cells are reported too", () => {
    const t = table(["Cell"]);
    t.table!.tableRows[0].tableCells[0].content = [para(text("Cell "), footnoteRef())];
    expect(check(para(text("Intro")), t)).toEqual([
      { kind: "table", quote: "Cell" },
      { kind: "footnote", quote: "Cell" },
    ]);
  });

  describe("links", () => {
    test.each(["https://sawhoa.com", "mailto:board@sawhoa.com", "tel:+13035551212"])(
      "%s is fine",
      (url) => {
        expect(check(para(text("Contact us", { link: url })))).toEqual([]);
      },
    );

    test("a javascript: link is a bad link", () => {
      expect(check(para(text("See "), text("this", { link: "javascript:alert(1)" })))).toEqual([
        { kind: "bad-link", quote: "See this" },
      ]);
    });

    test("a link without a scheme is a bad link", () => {
      expect(check(para(text("Visit us", { link: "www.sawhoa.com" })))).toEqual([
        { kind: "bad-link", quote: "Visit us" },
      ]);
    });

    test("links to a heading or bookmark in the doc are fine", () => {
      expect(
        check(
          para(text("Jump to dues", { link: { headingId: "h.abc" } })),
          para(text("Jump to bookmark", { link: { bookmarkId: "id.xyz" } })),
        ),
      ).toEqual([]);
    });

    test("a smart chip with a good address is fine", () => {
      expect(
        check(para(text("Minutes: "), richLink("https://drive.google.com/file/d/F1/view"))),
      ).toEqual([]);
    });

    test("a smart chip with a bad address is a bad link", () => {
      expect(check(para(text("Minutes: "), richLink("ftp://files.example.com/m.pdf")))).toEqual([
        { kind: "bad-link", quote: "Minutes: Linked file" },
      ]);
    });
  });

  test("section breaks, tables of contents, horizontal rules and people are ignored", () => {
    const toc: StructuralElement = {
      tableOfContents: { content: [para(text("Dues", { link: { headingId: "h.1" } }))] },
    };
    const extras = para(
      text("Ask "),
      { person: { personProperties: { name: "Sam", email: "sam@example.com" } } },
      { horizontalRule: {} },
    );
    expect(check(toc, extras)).toEqual([]);
  });

  test("problems are listed in document order", () => {
    const result = checkStructure(
      { ...doc(para(drawing("kix.d1")), table(["Fees"]), para(text("Note"), equation())), title: "" },
      { requireTitle: true },
    );
    expect(result.map((p) => p.kind)).toEqual(["untitled", "drawing", "table", "equation"]);
  });
});

describe("isAllowedHref", () => {
  test.each(["https://x.org", "http://x.org", "mailto:board@sawhoa.com", "tel:+13035551212"])(
    "accepts %s",
    (url) => {
      expect(isAllowedHref(url)).toBe(true);
    },
  );

  test.each(["javascript:alert(1)", "htp:/x", "www.x.org", "", "data:text/html,hi"])(
    "rejects %j",
    (url) => {
      expect(isAllowedHref(url)).toBe(false);
    },
  );
});

describe("checkImages", () => {
  function respond(status: number) {
    return vi.fn<typeof fetch>(async () => new Response(null, { status }));
  }

  test("a reachable image is fine", async () => {
    const fetchStub = respond(200);
    const d = doc(para(text("Pool"), inlineImage("kix.i1", { contentUri: "https://img.test/1" })));

    await expect(checkImages(d, fetchStub)).resolves.toEqual([]);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(String(fetchStub.mock.calls[0][0])).toBe("https://img.test/1");
  });

  test("a 403 is an unfetchable image", async () => {
    const d = doc(para(text("Pool"), inlineImage("kix.i1")));
    await expect(checkImages(d, respond(403))).resolves.toEqual([
      { kind: "image-unfetchable", quote: "Pool" },
    ]);
  });

  test("a fetch that throws is an unfetchable image", async () => {
    const fetchStub = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const d = doc(para(inlineImage("kix.i1")));
    await expect(checkImages(d, fetchStub)).resolves.toEqual([
      { kind: "image-unfetchable", quote: "" },
    ]);
  });

  test("an image with no contentUri is unfetchable and nothing is fetched", async () => {
    const fetchStub = respond(200);
    const d = doc(para(text("Pool"), inlineImage("kix.i1")));
    delete d.inlineObjects!["kix.i1"].inlineObjectProperties.embeddedObject.imageProperties!
      .contentUri;

    await expect(checkImages(d, fetchStub)).resolves.toEqual([
      { kind: "image-unfetchable", quote: "Pool" },
    ]);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  test("a 200 whose body fails to cancel is still a reachable image", async () => {
    const fetchStub = vi.fn<typeof fetch>(
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              throw new Error("cancel failed");
            },
          }),
          { status: 200 },
        ),
    );
    const d = doc(para(text("Pool"), inlineImage("kix.i1")));
    await expect(checkImages(d, fetchStub)).resolves.toEqual([]);
  });

  test("only images are fetched, each one", async () => {
    const fetchStub = respond(200);
    const d = doc(
      para(text("One"), inlineImage("kix.i1")),
      para(drawing("kix.d1"), chart("kix.c1")),
      para(text("Two"), inlineImage("kix.i2")),
    );

    await checkImages(d, fetchStub);
    expect(fetchStub.mock.calls.map(([url]) => String(url))).toEqual([
      "https://lh7-rt.googleusercontent.com/docsz/kix.i1",
      "https://lh7-rt.googleusercontent.com/docsz/kix.i2",
    ]);
  });

  test("a doc without images fetches nothing", async () => {
    const fetchStub = respond(200);
    await expect(checkImages(doc(para(text("Hi"))), fetchStub)).resolves.toEqual([]);
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe("commentText", () => {
  const kinds: ProblemKind[] = [
    "empty",
    "untitled",
    "table",
    "drawing",
    "chart",
    "equation",
    "footnote",
    "embedded",
    "floating-image",
    "image-unfetchable",
    "bad-link",
  ];
  const longQuote = "x".repeat(60);

  test.each(kinds)("%s starts with Website: and stays short", (kind) => {
    for (const quote of ["", longQuote]) {
      const message = commentText({ kind, quote });
      expect(message.startsWith("Website: ")).toBe(true);
      expect(message.length).toBeLessThan(400);
    }
  });

  test.each(kinds.filter((k) => k !== "empty" && k !== "untitled"))(
    "%s quotes the text it is near",
    (kind) => {
      expect(commentText({ kind, quote: "Trash pickup" })).toContain('"Trash pickup"');
      expect(commentText({ kind, quote: "" })).not.toContain('""');
    },
  );

  test("the table message reads as written", () => {
    expect(commentText({ kind: "table", quote: "Trash pickup" })).toBe(
      "Website: this page has a table near \"Trash pickup\", and the website can't show tables. " +
        "Please turn it into a list or plain paragraphs. The website won't show this change until it's fixed.",
    );
  });

  test("the floating image message says to choose In line", () => {
    expect(commentText({ kind: "floating-image", quote: "" })).toContain('"In line"');
  });

  test("every kind has its own message", () => {
    const messages = kinds.map((kind) => commentText({ kind, quote: "" }));
    expect(new Set(messages).size).toBe(kinds.length);
  });
});
