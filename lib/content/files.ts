import { cache } from "react";
import { googleId } from "@/lib/content/ids";
import { listFolder, type DriveFile } from "@/lib/google/api";

export type PdfLink = { id: string; name: string; href: string; createdAt: Date };

const PDF = "application/pdf";

/** One listing per folder per render. */
const listFolderOnce = cache(listFolder);

/** When the file was created; throws rather than give an Invalid Date. */
export function createdAt(file: DriveFile): Date {
  const date = new Date(file.createdTime);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Drive file ${file.id} has no valid created time: "${file.createdTime}"`);
  }
  return date;
}

/** The PDFs in the Newsletters folder, newest first, each named without ".pdf". */
export const listNewsletters = cache(async (): Promise<PdfLink[]> => {
  const files = await listFolderOnce(googleId("folders", "newsletters"));
  return files
    .filter((f) => f.mimeType === PDF)
    .map((f) => ({
      id: f.id,
      name: f.name.replace(/\.pdf$/i, ""),
      href: `/files/${encodeURIComponent(f.id)}`,
      createdAt: createdAt(f),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
});

/** IDs of the PDFs the site serves at /files/<id>: those in Newsletters and Documents. */
export const servablePdfIds = cache(async (): Promise<Set<string>> => {
  const folders = [googleId("folders", "newsletters"), googleId("folders", "documents")];
  const listings = await Promise.all(folders.map((id) => listFolderOnce(id)));
  return new Set(listings.flat().filter((f) => f.mimeType === PDF).map((f) => f.id));
});
