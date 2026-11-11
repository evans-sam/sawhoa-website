import { cache } from "react";
import { BlockedError } from "@/lib/content/blocked";
import { loadDoc } from "@/lib/content/doc";
import { createdAt } from "@/lib/content/files";
import { FILE_ID, googleId } from "@/lib/content/ids";
import type { Converted } from "@/lib/docs/convert";
import { getFileMeta, GoogleError, listFolder, type DriveFile } from "@/lib/google/api";

export type Announcement = { id: string; title: string; postedAt: Date; excerpt: string };

const GOOGLE_DOC = "application/vnd.google-apps.document";
/** Docs fetched from Google at once while listing. */
const PARALLEL_LOADS = 5;

/** A title starting with "draft", in any case: the doc is not published. */
export function isDraft(title: string): boolean {
  return /^\s*draft/i.test(title);
}

/**
 * A published announcement: a Google Doc in the Announcements folder that is
 * neither trashed nor a draft. The one rule for every place that shows an
 * announcement or anything from one.
 */
export function isPublishedAnnouncement(file: DriveFile, folderId: string): boolean {
  return (
    file.mimeType === GOOGLE_DOC &&
    file.parents?.includes(folderId) === true &&
    file.trashed !== true &&
    !isDraft(file.name)
  );
}

async function load(file: DriveFile): Promise<Announcement & Converted> {
  const postedAt = createdAt(file);
  const { title, tree, excerpt } = await loadDoc(file.id, { requireTitle: true });
  return { id: file.id, title, postedAt, excerpt, tree };
}

/**
 * `fn` applied to every item with at most `limit` calls under way at once,
 * results in item order. Rejects with the first failure, and starts no new
 * calls after it.
 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** The published announcements whose docs pass the checks, newest first. */
export const listAnnouncements = cache(async (): Promise<Announcement[]> => {
  const folderId = googleId("folders", "announcements");
  const files = (await listFolder(folderId)).filter((f) => isPublishedAnnouncement(f, folderId));
  const loaded = await mapLimit(files, PARALLEL_LOADS, async (file) => {
    try {
      return await load(file);
    } catch (error) {
      // A blocked doc is left out; the comments on it tell the editor why.
      if (error instanceof BlockedError) return null;
      throw error;
    }
  });
  return loaded
    .filter((a) => a !== null)
    .map(({ id, title, postedAt, excerpt }) => ({ id, title, postedAt, excerpt }))
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
});

/**
 * The announcement with this doc ID, or null when there is none to show: not a
 * Drive file ID, not a Google Doc in the Announcements folder, a draft,
 * trashed, or unknown to Google. Throws BlockedError when the doc is blocked.
 */
export const loadAnnouncement = cache(
  async (id: string): Promise<(Announcement & Converted) | null> => {
    const folderId = googleId("folders", "announcements");
    if (!FILE_ID.test(id)) return null;
    let file: DriveFile;
    try {
      file = await getFileMeta(id);
    } catch (error) {
      if (error instanceof GoogleError && error.status === 404) return null;
      throw error;
    }
    if (!isPublishedAnnouncement(file, folderId)) return null;
    return load(file);
  },
);
