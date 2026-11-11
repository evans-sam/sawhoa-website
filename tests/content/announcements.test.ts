import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isDraft, listAnnouncements, loadAnnouncement } from "@/lib/content/announcements";
import { BlockedError } from "@/lib/content/blocked";
import {
  createComment,
  getDoc,
  getFileMeta,
  GoogleError,
  listComments,
  listFolder,
} from "@/lib/google/api";
import type { DocsDocument } from "@/lib/docs/types";
import { doc, inlineImage, para, table, text } from "../docs/builders";
import { DOC, file, ids, PDF, serveFolders } from "./fixtures";

vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
vi.mock("@/lib/google/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/api")>()),
  getDoc: vi.fn(),
  listFolder: vi.fn(),
  getFileMeta: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
}));

const FOLDER = ids.folders.announcements;

/** A clean announcement doc titled `title` whose first paragraph is `body`. */
function post(title: string, body = `${title} body text.`): DocsDocument {
  return { ...doc(para(text(body))), title };
}

/** getDoc answers from this map of doc ID to document. */
function serveDocs(docs: Record<string, DocsDocument>) {
  vi.mocked(getDoc).mockImplementation(async (id) => {
    const found = docs[id];
    if (!found) throw new GoogleError(404, `no doc ${id}`);
    return found;
  });
}

beforeEach(() => {
  serveFolders({});
  vi.mocked(listComments).mockResolvedValue([]);
  vi.mocked(createComment).mockResolvedValue();
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("isDraft", () => {
  test("a title starting with 'draft' in any case, after any spaces", () => {
    expect(isDraft("DRAFT budget")).toBe(true);
    expect(isDraft(" draft: picnic")).toBe(true);
    expect(isDraft("Drafting the budget")).toBe(true);
    expect(isDraft("Pool opens")).toBe(false);
    expect(isDraft("Budget draft")).toBe(false);
  });
});

describe("listAnnouncements", () => {
  test("keeps only Google Docs that are not drafts", async () => {
    const time = "2026-11-01T16:00:00.000Z";
    serveFolders({ [FOLDER]: [
      file("doc-1", "Pool opens", DOC, time),
      file("doc-2", "DRAFT budget", DOC, time),
      file("doc-3", " draft: picnic", DOC, time),
      file("pdf-1", "Minutes.pdf", PDF, time),
      file("sheet-1", "Dues", "application/vnd.google-apps.spreadsheet", time),
      file("short-1", "Pool opens (shortcut)", "application/vnd.google-apps.shortcut", time),
      file("folder-1", "Archive", "application/vnd.google-apps.folder", time),
      file("doc-4", "Old news", DOC, time, { trashed: true }),
    ] });
    serveDocs({ "doc-1": post("Pool opens") });

    const list = await listAnnouncements();

    expect(listFolder).toHaveBeenCalledWith(FOLDER);
    expect(list).toEqual([
      { id: "doc-1", title: "Pool opens", postedAt: new Date(time), excerpt: "Pool opens body text." },
    ]);
    expect(getDoc).toHaveBeenCalledExactlyOnceWith("doc-1");
  });

  test("leaves out a blocked doc, comments on it, and lists the rest newest first", async () => {
    serveFolders({ [FOLDER]: [
      file("doc-a", "Spring cleanup", DOC, "2026-04-01T15:00:00Z"),
      file("doc-b", "Fee table", DOC, "2026-06-01T15:00:00Z"),
      file("doc-c", "Fall picnic", DOC, "2026-09-01T15:00:00Z"),
    ] });
    serveDocs({
      "doc-a": post("Spring cleanup"),
      "doc-b": { ...doc(para(text("Fees:")), table(["Dues", "$300"])), title: "Fee table" },
      "doc-c": post("Fall picnic"),
    });

    const list = await listAnnouncements();

    expect(list.map((a) => a.id)).toEqual(["doc-c", "doc-a"]);
    expect(createComment).toHaveBeenCalledOnce();
    expect(vi.mocked(createComment).mock.calls[0][0]).toBe("doc-b");
  });

  test("rejects when the folder cannot be listed", async () => {
    vi.mocked(listFolder).mockRejectedValue(new GoogleError(503, "Drive unavailable"));
    await expect(listAnnouncements()).rejects.toBeInstanceOf(GoogleError);
  });

  test("rejects when a doc cannot be fetched", async () => {
    serveFolders({ [FOLDER]: [
      file("doc-a", "Spring cleanup", DOC, "2026-04-01T15:00:00Z"),
      file("doc-b", "Fall picnic", DOC, "2026-09-01T15:00:00Z"),
    ] });
    vi.mocked(getDoc).mockImplementation(async (id) => {
      if (id === "doc-b") throw new GoogleError(500, "Docs failed");
      return post("Spring cleanup");
    });
    await expect(listAnnouncements()).rejects.toBeInstanceOf(GoogleError);
  });

  test("rejects when one announcement's image cannot be fetched for now", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    serveFolders({ [FOLDER]: [
      file("doc-a", "Spring cleanup", DOC, "2026-04-01T15:00:00Z"),
      file("doc-b", "Pool photo", DOC, "2026-09-01T15:00:00Z"),
    ] });
    serveDocs({
      "doc-a": post("Spring cleanup"),
      "doc-b": { ...doc(para(text("Pool"), inlineImage("kix.i1"))), title: "Pool photo" },
    });

    await expect(listAnnouncements()).rejects.toThrow(/temporarily/);
    expect(createComment).not.toHaveBeenCalled();
  });

  test("rejects when a doc's created time is not a date", async () => {
    serveFolders({ [FOLDER]: [file("doc-a", "Spring cleanup", DOC, "not a date")] });
    serveDocs({ "doc-a": post("Spring cleanup") });
    await expect(listAnnouncements()).rejects.toThrow(/doc-a/);
  });

  test("loads at most 5 docs at a time, and all of them", async () => {
    const files = Array.from({ length: 12 }, (_, i) =>
      file(`doc-${i}`, `Post ${i}`, DOC, new Date(Date.UTC(2026, 0, i + 1)).toISOString()),
    );
    serveFolders({ [FOLDER]: files });
    let running = 0;
    let most = 0;
    vi.mocked(getDoc).mockImplementation(async (id) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
      return post(`Post ${id.slice(4)}`);
    });

    const list = await listAnnouncements();

    expect(list).toHaveLength(12);
    expect(list[0].id).toBe("doc-11");
    expect(most).toBe(5);
  });

  test("refuses to call Google when the folder ID is missing", async () => {
    ids.folders.announcements = "";
    try {
      await expect(listAnnouncements()).rejects.toThrow(
        /folders\.announcements.*npm run content:discover/,
      );
      expect(listFolder).not.toHaveBeenCalled();
    } finally {
      ids.folders.announcements = FOLDER;
    }
  });
});

describe("loadAnnouncement", () => {
  const time = "2026-11-01T16:00:00Z";
  const ID = "1PoolOpensDoc000000000";

  test("a passing doc in the folder: its fields and page", async () => {
    vi.mocked(getFileMeta).mockResolvedValue(
      file(ID, "Pool opens", DOC, time, { parents: [FOLDER] }),
    );
    serveDocs({ [ID]: post("Pool opens") });

    const a = await loadAnnouncement(ID);

    expect(a).toMatchObject({
      id: ID,
      title: "Pool opens",
      postedAt: new Date(time),
      excerpt: "Pool opens body text.",
    });
    expect(a?.tree.children).toHaveLength(1);
  });

  test.each([
    ["a doc in the Pages folder", file(ID, "About", DOC, time, { parents: [ids.folders.pages] })],
    ["a draft", file(ID, "Draft: picnic", DOC, time, { parents: [FOLDER] })],
    ["a PDF", file(ID, "Minutes.pdf", PDF, time, { parents: [FOLDER] })],
    ["a trashed doc", file(ID, "Old news", DOC, time, { parents: [FOLDER], trashed: true })],
    ["a doc with no parents", file(ID, "Pool opens", DOC, time)],
  ])("null for %s", async (_, meta) => {
    vi.mocked(getFileMeta).mockResolvedValue(meta);
    await expect(loadAnnouncement(ID)).resolves.toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  test.each(["x", "../etc", "", "1Pool/../../x0000000"])(
    "null for the malformed ID %j, without calling Google",
    async (id) => {
      await expect(loadAnnouncement(id)).resolves.toBeNull();
      expect(getFileMeta).not.toHaveBeenCalled();
    },
  );

  test("null when Google answers 404", async () => {
    vi.mocked(getFileMeta).mockRejectedValue(new GoogleError(404, "File not found"));
    await expect(loadAnnouncement("1UnknownDoc000000000")).resolves.toBeNull();
  });

  test("rejects on any other Google error", async () => {
    vi.mocked(getFileMeta).mockRejectedValue(new GoogleError(500, "Drive failed"));
    await expect(loadAnnouncement(ID)).rejects.toBeInstanceOf(GoogleError);
  });

  test("a blocked doc throws BlockedError", async () => {
    vi.mocked(getFileMeta).mockResolvedValue(
      file(ID, "Fee table", DOC, time, { parents: [FOLDER] }),
    );
    serveDocs({ [ID]: { ...doc(table(["Dues", "$300"])), title: "Fee table" } });
    await expect(loadAnnouncement(ID)).rejects.toBeInstanceOf(BlockedError);
  });

  test("an untitled doc is blocked", async () => {
    vi.mocked(getFileMeta).mockResolvedValue(
      file(ID, "Untitled document", DOC, time, { parents: [FOLDER] }),
    );
    serveDocs({ [ID]: post("Untitled document") });
    await expect(loadAnnouncement(ID)).rejects.toThrow(/untitled/);
  });
});
