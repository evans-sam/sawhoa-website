import { afterEach, describe, expect, test, vi } from "vitest";
import { openDocImage, openPdf } from "@/lib/content/media";
import { downloadFile, getDoc, getFileMeta, GoogleError, type DriveFile } from "@/lib/google/api";
import type { DocsDocument } from "@/lib/docs/types";
import { chart, doc, drawing, inlineImage, para, text } from "../docs/builders";
import { DOC, file, ids, PDF } from "./fixtures";

vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
vi.mock("@/lib/google/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/api")>()),
  getDoc: vi.fn(),
  getFileMeta: vi.fn(),
  downloadFile: vi.fn(),
}));

const NEWSLETTER_PDF = "1NewsletterPdf000000000000000000";
const DOCUMENTS_PDF = "1DocumentsPdf0000000000000000000";
const IMAGE_URI = "https://lh7-rt.googleusercontent.com/docsz/signed-address";
const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/** getFileMeta answers from these files; any other ID is a Google 404. */
function serveMeta(...files: DriveFile[]) {
  vi.mocked(getFileMeta).mockImplementation(async (id) => {
    const found = files.find((f) => f.id === id);
    if (!found) throw new GoogleError(404, `no file ${id}`);
    return found;
  });
}

function pdf(id: string, parent: string, extra: Partial<DriveFile> = {}): DriveFile {
  return file(id, "June 2026 Newsletter.pdf", PDF, "2026-06-01T00:00:00Z", {
    parents: [parent],
    ...extra,
  });
}

function serveDownload(headers: Record<string, string> = {}) {
  vi.mocked(downloadFile).mockResolvedValue(new Response(BYTES, { headers }));
}

/** getDoc answers `document` for `docId`; any other ID is a Google 404. */
function serveDoc(docId: string, document: DocsDocument) {
  vi.mocked(getDoc).mockImplementation(async (id) => {
    if (id !== docId) throw new GoogleError(404, `no doc ${id}`);
    return { ...document, documentId: docId };
  });
}

function stubImageFetch(res: () => Response) {
  const fetchMock = vi.fn(async () => res());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("openPdf", () => {
  test("a newsletter PDF streams through as an inline PDF", async () => {
    serveMeta(pdf(NEWSLETTER_PDF, ids.folders.newsletters));
    serveDownload({ "Content-Type": "application/octet-stream", "Content-Length": "5" });

    const res = await openPdf(NEWSLETTER_PDF);

    expect(res?.status).toBe(200);
    expect(res?.headers.get("Content-Type")).toBe("application/pdf");
    expect(res?.headers.get("Content-Length")).toBe("5");
    expect(res?.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res?.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600");
    expect(res?.headers.get("Content-Disposition")).toBe(
      `inline; filename="June 2026 Newsletter.pdf"; filename*=UTF-8''June%202026%20Newsletter.pdf`,
    );
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(BYTES);
    expect(downloadFile).toHaveBeenCalledWith(NEWSLETTER_PDF);
  });

  test("a PDF in the Documents folder is served too", async () => {
    serveMeta(pdf(DOCUMENTS_PDF, ids.folders.documents));
    serveDownload();
    expect((await openPdf(DOCUMENTS_PDF))?.status).toBe(200);
  });

  test("the plain filename keeps only printable ASCII; filename* carries the real name", async () => {
    serveMeta(pdf(NEWSLETTER_PDF, ids.folders.newsletters, { name: 'Café "rules"\\\r\n(v2)\'s.pdf' }));
    serveDownload();
    const res = await openPdf(NEWSLETTER_PDF);
    expect(res?.headers.get("Content-Disposition")).toBe(
      `inline; filename="Caf rules(v2)'s.pdf"; ` +
        `filename*=UTF-8''Caf%C3%A9%20%22rules%22%5C%0D%0A%28v2%29%27s.pdf`,
    );
  });

  test("Content-Length is not forwarded when the upstream body was compressed", async () => {
    serveMeta(pdf(NEWSLETTER_PDF, ids.folders.newsletters));
    serveDownload({ "Content-Length": "3", "Content-Encoding": "gzip" });
    const res = await openPdf(NEWSLETTER_PDF);
    expect(res?.headers.get("Content-Length")).toBeNull();
  });

  test.each([
    ["a Pages doc", file(ids.pages.home, "Home", DOC, "2026-01-01T00:00:00Z", { parents: [ids.folders.pages] })],
    ["a PDF in some other folder", pdf(NEWSLETTER_PDF, "1SomeOtherFolder0000000000000000")],
    ["a PDF with no parents", file(NEWSLETTER_PDF, "x.pdf", PDF, "2026-01-01T00:00:00Z")],
    ["a trashed PDF", pdf(NEWSLETTER_PDF, ids.folders.newsletters, { trashed: true })],
    ["a doc in the Newsletters folder", file(NEWSLETTER_PDF, "Notes", DOC, "2026-01-01T00:00:00Z", { parents: [ids.folders.newsletters] })],
  ])("null for %s, and nothing is downloaded", async (_, meta) => {
    serveMeta(meta);
    expect(await openPdf(meta.id)).toBeNull();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  test.each(["../etc", "", "short", "1abc/../../x0000"])(
    "null for %j without asking Google",
    async (id) => {
      expect(await openPdf(id)).toBeNull();
      expect(getFileMeta).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    },
  );

  test.each([400, 403, 404])("null when Google answers %i for the file", async (status) => {
    vi.mocked(getFileMeta).mockRejectedValue(new GoogleError(status, "nope"));
    expect(await openPdf(NEWSLETTER_PDF)).toBeNull();
  });

  test("null when the download itself is a Google 404", async () => {
    serveMeta(pdf(NEWSLETTER_PDF, ids.folders.newsletters));
    vi.mocked(downloadFile).mockRejectedValue(new GoogleError(404, "gone"));
    expect(await openPdf(NEWSLETTER_PDF)).toBeNull();
  });

  test("any other Google failure throws", async () => {
    vi.mocked(getFileMeta).mockRejectedValue(new GoogleError(500, "boom"));
    await expect(openPdf(NEWSLETTER_PDF)).rejects.toThrow("boom");

    serveMeta(pdf(NEWSLETTER_PDF, ids.folders.newsletters));
    vi.mocked(downloadFile).mockRejectedValue(new GoogleError(429, "slow down"));
    await expect(openPdf(NEWSLETTER_PDF)).rejects.toThrow("slow down");
  });
});

describe("openDocImage", () => {
  const PAGE_DOC = ids.pages.about;
  const ANNOUNCEMENT = "1AnnouncementDoc0000000000000000";
  const pageDoc = doc(para(text("About us")), para(inlineImage("kix.img1", { contentUri: IMAGE_URI })));

  function imageResponse(type = "image/png", extra: Record<string, string> = {}) {
    return () => new Response(BYTES, { headers: { "Content-Type": type, ...extra } });
  }

  test("an image in a page doc streams through with its content type", async () => {
    serveDoc(PAGE_DOC, pageDoc);
    const fetchMock = stubImageFetch(imageResponse("image/png", { "Content-Length": "5" }));

    const res = await openDocImage(PAGE_DOC, "kix.img1");

    expect(res?.status).toBe(200);
    expect(res?.headers.get("Content-Type")).toBe("image/png");
    expect(res?.headers.get("Content-Length")).toBe("5");
    expect(res?.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res?.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, s-maxage=604800, immutable",
    );
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(BYTES);
    expect(fetchMock).toHaveBeenCalledWith(IMAGE_URI, expect.anything());
    // A page doc is known from content/google.json; Drive is not asked about it.
    expect(getFileMeta).not.toHaveBeenCalled();
  });

  test("an image in an announcement doc is served", async () => {
    serveMeta(
      file(ANNOUNCEMENT, "Pool opens", DOC, "2026-05-01T00:00:00Z", {
        parents: [ids.folders.announcements],
      }),
    );
    serveDoc(ANNOUNCEMENT, pageDoc);
    stubImageFetch(imageResponse("image/jpeg"));

    const res = await openDocImage(ANNOUNCEMENT, "kix.img1");
    expect(res?.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test.each([
    ["a doc in some other folder", file(ANNOUNCEMENT, "Secret", DOC, "2026-05-01T00:00:00Z", { parents: ["1SomeOtherFolder0000000000000000"] })],
    ["a trashed announcement", file(ANNOUNCEMENT, "Old", DOC, "2026-05-01T00:00:00Z", { parents: [ids.folders.announcements], trashed: true })],
    ["a PDF in the Announcements folder", file(ANNOUNCEMENT, "x.pdf", PDF, "2026-05-01T00:00:00Z", { parents: [ids.folders.announcements] })],
  ])("null for %s, and the doc is not read", async (_, meta) => {
    serveMeta(meta);
    const fetchMock = stubImageFetch(imageResponse());
    expect(await openDocImage(ANNOUNCEMENT, "kix.img1")).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("null for a doc ID Google does not know", async () => {
    serveMeta();
    expect(await openDocImage(ANNOUNCEMENT, "kix.img1")).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  test.each(["../etc", "", "short"])("null for doc ID %j without asking Google", async (id) => {
    expect(await openDocImage(id, "kix.img1")).toBeNull();
    expect(getFileMeta).not.toHaveBeenCalled();
    expect(getDoc).not.toHaveBeenCalled();
  });

  test.each(["kix.unknown", "", "constructor", "__proto__", "toString"])(
    "null for object ID %j that is not in the doc",
    async (objectId) => {
      serveDoc(PAGE_DOC, pageDoc);
      const fetchMock = stubImageFetch(imageResponse());
      expect(await openDocImage(PAGE_DOC, objectId)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["a drawing", drawing("kix.obj")],
    ["a chart", chart("kix.obj")],
  ])("null for %s", async (_, run) => {
    serveDoc(PAGE_DOC, doc(para(run)));
    const fetchMock = stubImageFetch(imageResponse());
    expect(await openDocImage(PAGE_DOC, "kix.obj")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each([400, 403, 404])("null when Google answers %i for the doc", async (status) => {
    vi.mocked(getDoc).mockRejectedValue(new GoogleError(status, "nope"));
    expect(await openDocImage(PAGE_DOC, "kix.img1")).toBeNull();
  });

  test("any other Google failure throws", async () => {
    vi.mocked(getDoc).mockRejectedValue(new GoogleError(503, "unavailable"));
    await expect(openDocImage(PAGE_DOC, "kix.img1")).rejects.toThrow("unavailable");
  });

  test.each([403, 404])("null when the image address answers %i", async (status) => {
    serveDoc(PAGE_DOC, pageDoc);
    stubImageFetch(() => new Response("gone", { status }));
    expect(await openDocImage(PAGE_DOC, "kix.img1")).toBeNull();
  });

  test("throws when the image address answers 5xx, without the address in the message", async () => {
    serveDoc(PAGE_DOC, pageDoc);
    stubImageFetch(() => new Response("oops", { status: 502 }));
    const error = await openDocImage(PAGE_DOC, "kix.img1").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("502");
    expect((error as Error).message).not.toContain(IMAGE_URI);
  });

  test("throws when the image fetch fails outright, without the address in the message", async () => {
    serveDoc(PAGE_DOC, pageDoc);
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError(`fetch failed for ${IMAGE_URI}`);
    }));
    const error = await openDocImage(PAGE_DOC, "kix.img1").catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain(IMAGE_URI);
  });

  test.each(["image/svg+xml", "IMAGE/SVG+XML; charset=utf-8", "text/html", ""])(
    "null when the upstream content type is %j",
    async (type) => {
      serveDoc(PAGE_DOC, pageDoc);
      stubImageFetch(() => {
        const res = new Response(BYTES);
        if (type) res.headers.set("Content-Type", type);
        else res.headers.delete("Content-Type");
        return res;
      });
      expect(await openDocImage(PAGE_DOC, "kix.img1")).toBeNull();
    },
  );
});
