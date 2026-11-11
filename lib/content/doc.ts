import { BlockedError } from "@/lib/content/blocked";
import { servablePdfIds } from "@/lib/content/files";
import { checkImages, checkStructure } from "@/lib/docs/check";
import { syncComments } from "@/lib/docs/comments";
import { convertDoc, type Converted } from "@/lib/docs/convert";
import { getDoc } from "@/lib/google/api";

/**
 * Fetches a Google Doc, checks it, brings the site's comments on it up to date
 * and converts it. Throws BlockedError when the doc has any problem.
 */
export async function loadDoc(
  docId: string,
  { requireTitle, faq = false }: { requireTitle: boolean; faq?: boolean },
): Promise<Converted & { title: string }> {
  const doc = await getDoc(docId);
  const problems = [...checkStructure(doc, { requireTitle }), ...(await checkImages(doc))];
  // Always, so a fixed doc has its old comments resolved.
  await syncComments(docId, problems);
  if (problems.length > 0) throw new BlockedError(docId, doc.title, problems);

  const converted = convertDoc(doc, { servablePdfIds: await servablePdfIds(), faq });
  return { title: doc.title.trim(), ...converted };
}
