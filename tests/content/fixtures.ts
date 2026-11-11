/**
 * Shared test data for the content loaders: real-looking Google IDs standing
 * in for content/google.json, and Drive file records.
 *
 * Each test file mocks the JSON with these IDs:
 *   vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
 * A test may blank one ID to check the loader refuses to call Google, and must
 * restore it afterwards.
 */
import { vi } from "vitest";
import { listFolder, type DriveFile } from "@/lib/google/api";

export const ids = {
  rootFolderId: "1RootFolder000000000000000000000",
  folders: {
    pages: "1PagesFolder00000000000000000000",
    announcements: "1AnnouncementsFolder000000000000",
    newsletters: "1NewslettersFolder00000000000000",
    documents: "1DocumentsFolder0000000000000000",
  },
  pages: {
    home: "1HomeDoc000000000000000000000000",
    about: "1AboutDoc00000000000000000000000",
    faq: "1FaqDoc0000000000000000000000000",
    buyingSelling: "1BuyingSellingDoc000000000000000",
    documents: "1DocumentsDoc0000000000000000000",
    payDues: "1PayDuesDoc000000000000000000000",
  },
  calendars: {
    events: "events@group.calendar.google.com",
    banner: "banner@group.calendar.google.com",
  },
};

export const DOC = "application/vnd.google-apps.document";
export const PDF = "application/pdf";

export function file(
  id: string,
  name: string,
  mimeType: string,
  createdTime: string,
  extra: Partial<DriveFile> = {},
): DriveFile {
  return { id, name, mimeType, createdTime, ...extra };
}

/**
 * Makes the mocked listFolder answer from this map of folder ID to files;
 * any other content folder is empty. Call it from a test file that mocks
 * "@/lib/google/api".
 */
export function serveFolders(folders: Record<string, DriveFile[]>): void {
  const known = new Set(Object.values(ids.folders));
  vi.mocked(listFolder).mockImplementation(async (id) => {
    if (folders[id]) return folders[id];
    if (known.has(id)) return [];
    throw new Error(`unexpected listFolder(${id})`);
  });
}
