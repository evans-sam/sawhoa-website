import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toHtml } from "hast-util-to-html";
import { describe, expect, test } from "vitest";
import { DocBody } from "@/components/DocBody";
import { convertDoc } from "@/lib/docs/convert";
import type { DocsDocument, StructuralElement } from "@/lib/docs/types";
import {
  chart,
  dateChip,
  doc,
  drawing,
  embedded,
  equation,
  footnoteRef,
  inlineImage,
  listItem,
  pageBreak,
  para,
  personChip,
  positioned,
  richLink,
  styled,
  table,
  text,
} from "./builders";

const PDF_LINK = "https://drive.google.com/file/d/PDF1/view?usp=sharing";
const noPdfs = { servablePdfIds: new Set<string>() };

function html(d: DocsDocument, opts: Parameters<typeof convertDoc>[1] = noPdfs): string {
  return toHtml(convertDoc(d, opts).tree);
}

function convert(...elements: StructuralElement[]): string {
  return html(doc(...elements));
}

describe("convertDoc", () => {
  test("output is a hast root", () => {
    expect(convertDoc(doc(para(text("Hi"))), noPdfs).tree.type).toBe("root");
  });

  test("a normal paragraph becomes <p>", () => {
    expect(convert(para(text("Hello")))).toBe("<p>Hello</p>");
  });

  test("doc headings shift down one level and the title paragraph is dropped", () => {
    expect(
      convert(
        styled("TITLE", text("About us")),
        styled("HEADING_1", text("Board")),
        styled("HEADING_2", text("Officers")),
        styled("HEADING_3", text("Treasurer")),
        para(text("Body")),
      ),
    ).toBe("<h2>Board</h2><h3>Officers</h3><h4>Treasurer</h4><p>Body</p>");
  });

  test("bold and italic become strong and em", () => {
    expect(
      convert(
        para(
          text("Dues are "),
          text("due", { style: { bold: true } }),
          text(" on "),
          text("Jan 1", { style: { italic: true } }),
          text(" and "),
          text("both", { style: { bold: true, italic: true } }),
        ),
      ),
    ).toBe("<p>Dues are <strong>due</strong> on <em>Jan 1</em> and <strong><em>both</em></strong></p>");
  });

  test("a link becomes a[href]", () => {
    expect(convert(para(text("Read "), text("the rules", { link: "https://x.org/rules" })))).toBe(
      '<p>Read <a href="https://x.org/rules" rel="noopener">the rules</a></p>',
    );
  });

  test("a bold run inside a link keeps both, and adjacent runs of one link share one <a>", () => {
    expect(
      convert(
        para(
          text("the ", { link: "https://x.org" }),
          text("bold", { link: "https://x.org", style: { bold: true, underline: true } }),
          text(" link", { link: "https://x.org" }),
        ),
      ),
    ).toBe('<p><a href="https://x.org" rel="noopener">the <strong>bold</strong> link</a></p>');
  });

  test("a bulleted list becomes ul>li and a numbered list ol>li", () => {
    expect(
      convert(
        listItem({ kind: "bullet" }, text("Pool")),
        listItem({ kind: "bullet" }, text("Park")),
        para(text("Then")),
        listItem({ kind: "number" }, text("First")),
        listItem({ kind: "number" }, text("Second")),
      ),
    ).toBe(
      "<ul><li>Pool</li><li>Park</li></ul><p>Then</p><ol><li>First</li><li>Second</li></ol>",
    );
  });

  test("a nested list item goes inside the item before it", () => {
    expect(
      convert(
        listItem({ kind: "bullet" }, text("Amenities")),
        listItem({ kind: "bullet", level: 1 }, text("Pool")),
        listItem({ kind: "bullet", level: 1 }, text("Park")),
        listItem({ kind: "bullet" }, text("Fees")),
      ),
    ).toBe("<ul><li>Amenities<ul><li>Pool</li><li>Park</li></ul></li><li>Fees</li></ul>");
  });

  test("a numbered list split by a paragraph keeps counting", () => {
    expect(
      convert(
        listItem({ kind: "number" }, text("One")),
        listItem({ kind: "number" }, text("Two")),
        para(text("Aside")),
        listItem({ kind: "number" }, text("Three")),
      ),
    ).toBe('<ol><li>One</li><li>Two</li></ol><p>Aside</p><ol start="3"><li>Three</li></ol>');
  });

  test("strikethrough becomes <s>; underline is dropped", () => {
    expect(
      convert(
        para(
          text("$300", { style: { strikethrough: true } }),
          text(" $350", { style: { underline: true } }),
        ),
      ),
    ).toBe("<p><s>$300</s> $350</p>");
  });

  test("two lists back to back stay separate", () => {
    expect(
      convert(
        listItem({ kind: "bullet", listId: "a" }, text("One")),
        listItem({ kind: "number", listId: "b" }, text("Two")),
      ),
    ).toBe("<ul><li>One</li></ul><ol><li>Two</li></ol>");
  });

  test("a list whose definition is missing from the doc is a bulleted list", () => {
    const d = doc(listItem({ kind: "number" }, text("One")));
    delete d.lists;
    expect(html(d)).toBe("<ul><li>One</li></ul>");
  });

  test("no element has a style, class or id from the doc", () => {
    const heading = styled("HEADING_1", text("Dues"));
    heading.paragraph!.paragraphStyle = {
      namedStyleType: "HEADING_1",
      headingId: "h.abc",
      alignment: "CENTER",
      indentStart: { magnitude: 36, unit: "PT" },
    };
    const out = convert(
      heading,
      para(
        text("Big purple", {
          style: {
            fontSize: { magnitude: 24, unit: "PT" },
            foregroundColor: { color: { rgbColor: { red: 0.5, blue: 0.5 } } },
            backgroundColor: { color: { rgbColor: { green: 1 } } },
            weightedFontFamily: { fontFamily: "Lobster", weight: 400 },
          },
        }),
      ),
      listItem({ kind: "number" }, text("Item")),
    );
    expect(out).toBe("<h2>Dues</h2><p>Big purple</p><ol><li>Item</li></ol>");
    expect(out).not.toMatch(/\s(style|class|id)=/);
  });

  describe("images", () => {
    function imageDoc(...runs: Parameters<typeof para>) {
      return { ...doc(para(...runs)), documentId: "D1" };
    }

    test("an inline image is served from /media with alt from its description", () => {
      expect(html(imageDoc(inlineImage("kix.abc", { description: "The pool", title: "Pool" })))).toBe(
        '<p><img src="/media/D1/kix.abc" alt="The pool" loading="lazy"></p>',
      );
    });

    test("alt falls back to the title, then to empty", () => {
      expect(html(imageDoc(inlineImage("kix.abc", { title: "Pool" })))).toContain('alt="Pool"');
      expect(html(imageDoc(inlineImage("kix.abc")))).toContain('alt=""');
    });

    test("an image with an allowed link is wrapped in <a>", () => {
      expect(html(imageDoc(inlineImage("kix.abc", { link: "https://x.org" })))).toBe(
        '<p><a href="https://x.org" rel="noopener"><img src="/media/D1/kix.abc" alt="" loading="lazy"></a></p>',
      );
    });

    test("an image with a disallowed link is shown without a link", () => {
      expect(html(imageDoc(inlineImage("kix.abc", { link: "javascript:alert(1)" })))).toBe(
        '<p><img src="/media/D1/kix.abc" alt="" loading="lazy"></p>',
      );
    });

    test("an image linked to a servable PDF links to /files", () => {
      expect(
        html(imageDoc(inlineImage("kix.abc", { link: PDF_LINK })), {
          servablePdfIds: new Set(["PDF1"]),
        }),
      ).toContain('<a href="/files/PDF1"><img');
    });
  });

  describe("links", () => {
    test("a Drive link to a servable PDF becomes /files/<id>", () => {
      expect(
        html(doc(para(text("Minutes", { link: PDF_LINK }))), { servablePdfIds: new Set(["PDF1"]) }),
      ).toBe('<p><a href="/files/PDF1">Minutes</a></p>');
    });

    test("a Drive link to a file not in the set is left unchanged", () => {
      expect(
        html(doc(para(text("Minutes", { link: PDF_LINK }))), { servablePdfIds: new Set(["OTHER"]) }),
      ).toBe(`<p><a href="${PDF_LINK}" rel="noopener">Minutes</a></p>`);
    });

    test("a smart chip becomes a link with its title, with the same Drive rewrite", () => {
      expect(
        html(doc(para(text("See "), richLink(PDF_LINK, "May minutes"))), {
          servablePdfIds: new Set(["PDF1"]),
        }),
      ).toBe('<p>See <a href="/files/PDF1">May minutes</a></p>');
      expect(convert(para(richLink("https://x.org/a", "A page")))).toBe(
        '<p><a href="https://x.org/a" rel="noopener">A page</a></p>',
      );
    });

    test("a smart chip without a title shows its address", () => {
      const chip = richLink("https://x.org/a");
      delete chip.richLink!.richLinkProperties.title;
      expect(convert(para(chip))).toBe(
        '<p><a href="https://x.org/a" rel="noopener">https://x.org/a</a></p>',
      );
    });

    test("a link to a heading or bookmark in the doc renders as plain text", () => {
      expect(
        convert(
          para(
            text("Jump to ", {}),
            text("dues", { link: { headingId: "h.abc" } }),
            text(" or "),
            text("here", { link: { bookmarkId: "id.xyz" } }),
          ),
        ),
      ).toBe("<p>Jump to dues or here</p>");
    });

    test("mailto: and tel: links get no rel", () => {
      expect(
        convert(
          para(
            text("Email", { link: "mailto:board@sawhoa.com" }),
            text(" or "),
            text("call", { link: "tel:+13035551212" }),
          ),
        ),
      ).toBe('<p><a href="mailto:board@sawhoa.com">Email</a> or <a href="tel:+13035551212">call</a></p>');
    });

    test("http: links get rel=noopener", () => {
      expect(convert(para(text("Old site", { link: "http://x.org" })))).toBe(
        '<p><a href="http://x.org" rel="noopener">Old site</a></p>',
      );
    });

    test.each(["javascript:alert(1)", "www.sawhoa.com", "data:text/html,hi"])(
      "a %s link never reaches the output, from a text run or a chip",
      (url) => {
        const out = convert(para(text("Click", { link: url }), text(" "), richLink(url, "chip")));
        expect(out).toBe("<p>Click chip</p>");
        expect(out).not.toContain("<a");
      },
    );
  });

  test("person and date chips render as plain text", () => {
    expect(
      convert(
        para(
          text("Ask "),
          personChip({ name: "Sam", email: "sam@example.com" }),
          text(" or "),
          personChip({ email: "kim@example.com" }),
          text(" by "),
          dateChip("Nov 11, 2026"),
        ),
      ),
    ).toBe("<p>Ask Sam or kim@example.com by Nov 11, 2026</p>");
  });

  test("a soft line break becomes <br>", () => {
    expect(convert(para(text("Line one\u000bLine two")))).toBe("<p>Line one<br>Line two</p>");
  });

  test("empty paragraphs are dropped", () => {
    expect(convert(para(text("One")), para(), para(text("  ")), para(text("Two")))).toBe(
      "<p>One</p><p>Two</p>",
    );
  });

  test("a <script> typed in the doc is text, not an element", () => {
    const tree = convertDoc(doc(para(text("<script>alert(1)</script>"))), noPdfs).tree;
    expect(toHtml(tree)).toBe("<p>&#x3C;script>alert(1)&#x3C;/script></p>");
    expect(JSON.stringify(tree)).not.toContain('"tagName":"script"');
  });

  test("blocked content is dropped without throwing", () => {
    const d = doc(
      para(text("Intro")),
      table(["Fee", "$300"]),
      para(text("A"), drawing("kix.d1"), chart("kix.c1"), embedded("kix.e1")),
      para(text("B"), footnoteRef(), equation(), pageBreak(), { horizontalRule: {} }),
      positioned("kix.p1", text("C")),
      para(text("D"), { inlineObjectElement: { inlineObjectId: "kix.missing" } }),
      { tableOfContents: { content: [para(text("Contents"))] } },
    );
    expect(html(d)).toBe("<p>Intro</p><p>A</p><p>B</p><p>C</p><p>D</p>");
  });

  describe("faq", () => {
    test("each doc Heading 3 and what follows it becomes a <details>", () => {
      const d = doc(
        styled("HEADING_2", text("Dues")),
        styled("HEADING_3", text("How much?")),
        para(text("$300 a year.")),
        styled("HEADING_3", text("When?")),
        para(text("By January 31.")),
      );
      expect(html(d, { ...noPdfs, faq: true })).toBe(
        "<h3>Dues</h3>" +
          "<details><summary>How much?</summary><p>$300 a year.</p></details>" +
          "<details><summary>When?</summary><p>By January 31.</p></details>",
      );
    });

    test("an answer runs to the next heading of any level and can hold lists", () => {
      const d = doc(
        styled("HEADING_3", text("What can I use?")),
        para(text("These:")),
        listItem({ kind: "bullet" }, text("Pool")),
        styled("HEADING_2", text("Rules")),
        para(text("Be kind.")),
      );
      expect(html(d, { ...noPdfs, faq: true })).toBe(
        "<details><summary>What can I use?</summary><p>These:</p><ul><li>Pool</li></ul></details>" +
          "<h3>Rules</h3><p>Be kind.</p>",
      );
    });

    test("without faq, Heading 3 is an ordinary heading", () => {
      expect(convert(styled("HEADING_3", text("How much?")), para(text("$300")))).toBe(
        "<h4>How much?</h4><p>$300</p>",
      );
    });
  });

  describe("excerpt", () => {
    function excerpt(...elements: StructuralElement[]) {
      return convertDoc(doc(...elements), noPdfs).excerpt;
    }

    test("is the first non-empty paragraph's text, trimmed", () => {
      expect(
        excerpt(
          styled("TITLE", text("Pool opening")),
          styled("HEADING_1", text("When")),
          para(),
          para(text("  The pool opens "), text("May 1", { style: { bold: true } }), text(".  ")),
          para(text("Second")),
        ),
      ).toBe("The pool opens May 1.");
    });

    test("is empty when there is no paragraph", () => {
      expect(excerpt(styled("HEADING_1", text("Only a heading")))).toBe("");
    });

    test("a text of exactly 280 characters is not cut", () => {
      const exact = "a".repeat(280);
      expect(excerpt(para(text(exact)))).toBe(exact);
    });

    test("a longer text is cut at a word boundary with an ellipsis", () => {
      const long = "word ".repeat(100).trim(); // 499 characters
      const result = excerpt(para(text(long)));
      expect(result.endsWith("word…")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(281);
      expect(result).toBe("word ".repeat(56).trim() + "…");
    });

    test("a single word longer than 280 characters is cut hard", () => {
      expect(excerpt(para(text("x".repeat(300))))).toBe("x".repeat(280) + "…");
    });
  });
});

describe("DocBody", () => {
  test("renders the tree as React elements", () => {
    const { tree } = convertDoc(
      doc(styled("HEADING_1", text("Dues")), para(text("Pay "), text("here", { link: "https://x.org" }))),
      noPdfs,
    );
    expect(renderToStaticMarkup(createElement(DocBody, { tree }))).toBe(
      '<h2>Dues</h2><p>Pay <a href="https://x.org" rel="noopener">here</a></p>',
    );
  });
});
