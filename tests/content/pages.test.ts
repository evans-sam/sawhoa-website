import { toHtml } from "hast-util-to-html";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BlockedError } from "@/lib/content/blocked";
import { loadPage } from "@/lib/content/pages";
import { commentText } from "@/lib/docs/messages";
import {
  createComment,
  getDoc,
  GoogleError,
  listComments,
  listFolder,
  resolveComment,
} from "@/lib/google/api";
import type { DocsDocument } from "@/lib/docs/types";
import { doc, inlineImage, para, styled, table, text } from "../docs/builders";
import { file, ids, PDF, serveFolders } from "./fixtures";

vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
vi.mock("@/lib/google/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/api")>()),
  getDoc: vi.fn(),
  listFolder: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
}));

function titled(title: string, d: DocsDocument): DocsDocument {
  return { ...d, title };
}

beforeEach(() => {
  serveFolders({});
  vi.mocked(listComments).mockResolvedValue([]);
  vi.mocked(createComment).mockResolvedValue();
  vi.mocked(resolveComment).mockResolvedValue();
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("loadPage", () => {
  test("a clean doc: fetched by its ID and converted", async () => {
    vi.mocked(getDoc).mockResolvedValue(titled("About", doc(para(text("We are a neighborhood.")))));

    const page = await loadPage("about");

    expect(getDoc).toHaveBeenCalledExactlyOnceWith(ids.pages.about);
    expect(toHtml(page.tree)).toBe("<p>We are a neighborhood.</p>");
    expect(page.excerpt).toBe("We are a neighborhood.");
  });

  test("a doc with a table throws BlockedError naming the doc and its edit link", async () => {
    vi.mocked(getDoc).mockResolvedValue(
      titled("About the HOA", doc(para(text("Fees")), table(["Dues", "$300"]))),
    );

    const error = await loadPage("about").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BlockedError);
    const blocked = error as BlockedError;
    const url = `https://docs.google.com/document/d/${ids.pages.about}/edit`;
    expect(blocked.message).toBe(`Blocked: "About the HOA" (${url}): table`);
    expect(blocked.docTitle).toBe("About the HOA");
    expect(blocked.docUrl).toBe(url);
    expect(blocked.problems).toEqual([{ kind: "table", quote: "Dues" }]);
    expect(createComment).toHaveBeenCalledExactlyOnceWith(
      ids.pages.about,
      commentText({ kind: "table", quote: "Dues" }),
    );
  });

  test("the message uses the trimmed doc title", async () => {
    vi.mocked(getDoc).mockResolvedValue(titled("  About the HOA \n", doc(table(["Dues"]))));
    const error = (await loadPage("about").catch((e: unknown) => e)) as BlockedError;
    expect(error.docTitle).toBe("About the HOA");
    expect(error.message).toMatch(/^Blocked: "About the HOA" \(/);
  });

  test("an image host failing for now rejects without BlockedError or comment changes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    vi.mocked(listComments).mockResolvedValue([
      {
        id: "c1",
        content: commentText({ kind: "image-unfetchable", quote: "Pool" }),
        resolved: false,
        author: { me: true },
      },
    ]);
    vi.mocked(getDoc).mockResolvedValue(
      titled("About", doc(para(text("Pool"), inlineImage("kix.i1")))),
    );

    const error = await loadPage("about").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(BlockedError);
    expect((error as Error).message).toMatch(/temporarily/);
    expect(createComment).not.toHaveBeenCalled();
    expect(resolveComment).not.toHaveBeenCalled();
  });

  test("a clean doc with a stale comment of ours: the comment is resolved", async () => {
    vi.mocked(getDoc).mockResolvedValue(titled("About", doc(para(text("Fixed now.")))));
    vi.mocked(listComments).mockResolvedValue([
      {
        id: "c1",
        content: commentText({ kind: "table", quote: "Dues" }),
        resolved: false,
        author: { me: true },
      },
    ]);

    await loadPage("about");

    expect(resolveComment).toHaveBeenCalledExactlyOnceWith(ids.pages.about, "c1");
    expect(createComment).not.toHaveBeenCalled();
  });

  test("the FAQ page groups each question and its answer", async () => {
    vi.mocked(getDoc).mockResolvedValue(
      titled("FAQ", doc(styled("HEADING_3", text("When are dues due?")), para(text("January 1.")))),
    );

    const page = await loadPage("faq");

    expect(getDoc).toHaveBeenCalledWith(ids.pages.faq);
    expect(toHtml(page.tree)).toBe(
      "<details><summary>When are dues due?</summary><p>January 1.</p></details>",
    );
  });

  test("other pages keep headings as headings", async () => {
    vi.mocked(getDoc).mockResolvedValue(
      titled("Home", doc(styled("HEADING_3", text("Welcome")), para(text("Hello.")))),
    );
    expect(toHtml((await loadPage("home")).tree)).toBe("<h4>Welcome</h4><p>Hello.</p>");
  });

  test("an untitled page doc is not blocked", async () => {
    vi.mocked(getDoc).mockResolvedValue(titled("Untitled document", doc(para(text("Hello.")))));
    await expect(loadPage("home")).resolves.toBeDefined();
  });

  test("a Drive link to a PDF in Newsletters or Documents becomes /files/<id>", async () => {
    serveFolders({
      [ids.folders.newsletters]: [file("PDF1", "Fall.pdf", PDF, "2026-10-01T00:00:00Z")],
      [ids.folders.documents]: [file("PDF2", "Bylaws.pdf", PDF, "2026-01-01T00:00:00Z")],
    });
    vi.mocked(getDoc).mockResolvedValue(
      titled(
        "Documents",
        doc(
          para(text("Newsletter", { link: "https://drive.google.com/file/d/PDF1/view" })),
          para(text("Bylaws", { link: "https://drive.google.com/file/d/PDF2/view" })),
        ),
      ),
    );

    const html = toHtml((await loadPage("documents")).tree);

    expect(html).toContain('<a href="/files/PDF1">Newsletter</a>');
    expect(html).toContain('<a href="/files/PDF2">Bylaws</a>');
  });

  test("rejects when Google fails, without BlockedError", async () => {
    vi.mocked(getDoc).mockRejectedValue(new GoogleError(500, "Docs failed"));
    await expect(loadPage("about")).rejects.toBeInstanceOf(GoogleError);
    expect(listComments).not.toHaveBeenCalled();
  });

  test("rejects when the PDF folders cannot be listed", async () => {
    vi.mocked(getDoc).mockResolvedValue(titled("About", doc(para(text("Hello.")))));
    vi.mocked(listFolder).mockRejectedValue(new GoogleError(503, "Drive unavailable"));
    await expect(loadPage("about")).rejects.toBeInstanceOf(GoogleError);
  });

  test("refuses to call Google when the page's ID is missing", async () => {
    ids.pages.payDues = "";
    try {
      await expect(loadPage("payDues")).rejects.toThrow(
        /pages\.payDues.*npm run content:discover/,
      );
      expect(getDoc).not.toHaveBeenCalled();
    } finally {
      ids.pages.payDues = "1PayDuesDoc000000000000000000000";
    }
  });
});
