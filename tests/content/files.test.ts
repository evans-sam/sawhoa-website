import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listNewsletters, servablePdfIds } from "@/lib/content/files";
import { GoogleError, listFolder } from "@/lib/google/api";
import { DOC, file, ids, PDF, serveFolders } from "./fixtures";

vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
vi.mock("@/lib/google/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/api")>()),
  listFolder: vi.fn(),
}));

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

beforeEach(() => {
  serveFolders({});
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("listNewsletters", () => {
  test("PDFs only, newest first, named without .pdf, linked to /files/<id>", async () => {
    serveFolders({
      [ids.folders.newsletters]: [
        file("n-spring", "2026 Spring Newsletter.pdf", PDF, "2026-04-01T15:00:00Z"),
        file("n-fall", "2026 Fall Newsletter.pdf", PDF, "2026-10-01T15:00:00Z"),
        file("n-draft", "Fall draft.docx", DOCX, "2026-10-05T15:00:00Z"),
        file("n-summer", "2026 Summer Newsletter.PDF", PDF, "2026-07-01T15:00:00Z"),
      ],
    });

    const list = await listNewsletters();

    expect(listFolder).toHaveBeenCalledExactlyOnceWith(ids.folders.newsletters);
    expect(list).toEqual([
      {
        id: "n-fall",
        name: "2026 Fall Newsletter",
        href: "/files/n-fall",
        createdAt: new Date("2026-10-01T15:00:00Z"),
      },
      {
        id: "n-summer",
        name: "2026 Summer Newsletter",
        href: "/files/n-summer",
        createdAt: new Date("2026-07-01T15:00:00Z"),
      },
      {
        id: "n-spring",
        name: "2026 Spring Newsletter",
        href: "/files/n-spring",
        createdAt: new Date("2026-04-01T15:00:00Z"),
      },
    ]);
  });

  test("rejects when the folder cannot be listed", async () => {
    vi.mocked(listFolder).mockRejectedValue(new GoogleError(503, "Drive unavailable"));
    await expect(listNewsletters()).rejects.toBeInstanceOf(GoogleError);
  });

  test("rejects when a created time is not a date", async () => {
    serveFolders({ [ids.folders.newsletters]: [file("n-1", "Fall.pdf", PDF, "")] });
    await expect(listNewsletters()).rejects.toThrow(/n-1/);
  });

  test("refuses to call Google when the folder ID is missing", async () => {
    ids.folders.newsletters = "";
    try {
      await expect(listNewsletters()).rejects.toThrow(
        /folders\.newsletters.*npm run content:discover/,
      );
      expect(listFolder).not.toHaveBeenCalled();
    } finally {
      ids.folders.newsletters = "1NewslettersFolder00000000000000";
    }
  });
});

describe("servablePdfIds", () => {
  test("the PDFs in Newsletters and Documents, nothing else", async () => {
    serveFolders({
      [ids.folders.newsletters]: [
        file("n-1", "Fall.pdf", PDF, "2026-10-01T15:00:00Z"),
        file("n-2", "Fall.docx", DOCX, "2026-10-01T15:00:00Z"),
      ],
      [ids.folders.documents]: [
        file("d-1", "Bylaws.pdf", PDF, "2026-01-01T15:00:00Z"),
        file("d-2", "Rules", DOC, "2026-01-01T15:00:00Z"),
      ],
      [ids.folders.pages]: [file("p-1", "Secret.pdf", PDF, "2026-01-01T15:00:00Z")],
    });

    expect(await servablePdfIds()).toEqual(new Set(["n-1", "d-1"]));
    expect(listFolder).not.toHaveBeenCalledWith(ids.folders.pages);
  });
});
