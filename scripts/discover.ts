/**
 * Writes content/google.json from the root content folder and the two calendars.
 *
 * Usage (from the repo root):
 *   npx tsx --env-file=.env.local scripts/discover.ts <rootFolderId> <eventsCalendarId> <bannerCalendarId>
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { listFolder } from "@/lib/google/api";
import { findFolders, findPageDocs } from "@/lib/google/discover";

const USAGE =
  "Usage: npx tsx --env-file=.env.local scripts/discover.ts <rootFolderId> <eventsCalendarId> <bannerCalendarId>";

async function main(): Promise<void> {
  const [rootFolderId, events, banner] = process.argv.slice(2);
  if (!rootFolderId || !events || !banner) {
    console.error(USAGE);
    process.exit(1);
  }

  const folders = findFolders(await listFolder(rootFolderId));
  const pages = findPageDocs(await listFolder(folders.pages));
  const ids = { rootFolderId, folders, pages, calendars: { events, banner } };

  const out = join(process.cwd(), "content", "google.json");
  writeFileSync(out, JSON.stringify(ids, null, 2) + "\n");
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
