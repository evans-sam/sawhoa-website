import type { DriveFile } from "@/lib/google/api";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";

/** Subfolders of the root content folder. */
export const FOLDER_NAMES = {
  pages: "Pages",
  announcements: "Announcements",
  newsletters: "Newsletters",
  documents: "Documents",
} as const;

/** Docs in the Pages folder, one per fixed page. */
export const PAGE_DOC_NAMES = {
  home: "Home",
  about: "About",
  faq: "FAQ",
  buyingSelling: "Buying and Selling",
  documents: "Documents",
  payDues: "Pay Dues",
} as const;

/**
 * Maps each wanted key to the ID of the one file of `mimeType` whose name
 * matches, ignoring case. Throws naming every name that is missing or
 * appears more than once.
 */
function pickByName<K extends string>(
  files: DriveFile[],
  wanted: Record<K, string>,
  mimeType: string,
  kind: string,
): Record<K, string> {
  const found = {} as Record<K, string>;
  const missing: string[] = [];
  const duplicated: string[] = [];
  for (const key of Object.keys(wanted) as K[]) {
    const name = wanted[key];
    const matches = files.filter(
      (f) => f.mimeType === mimeType && f.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (matches.length === 0) missing.push(`"${name}"`);
    else if (matches.length > 1) duplicated.push(`"${name}"`);
    else found[key] = matches[0].id;
  }
  const problems = [
    missing.length ? `could not find ${kind} ${missing.join(", ")}` : "",
    duplicated.length ? `found more than one ${kind} named ${duplicated.join(", ")}` : "",
  ].filter(Boolean);
  if (problems.length) throw new Error(problems.join("; "));
  return found;
}

/** IDs of the four subfolders, from a listing of the root content folder. */
export function findFolders(rootFiles: DriveFile[]): Record<keyof typeof FOLDER_NAMES, string> {
  return pickByName(rootFiles, FOLDER_NAMES, FOLDER_MIME, "folder");
}

/** IDs of the six page docs, from a listing of the Pages folder. */
export function findPageDocs(pageFiles: DriveFile[]): Record<keyof typeof PAGE_DOC_NAMES, string> {
  return pickByName(pageFiles, PAGE_DOC_NAMES, DOC_MIME, "page doc");
}
