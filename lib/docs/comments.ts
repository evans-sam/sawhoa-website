/**
 * Keeps the site's comments on a Google Doc in step with the doc's problems:
 * one open comment per problem while it is blocked, each resolved once fixed.
 */
import { commentText } from "@/lib/docs/messages";
import type { Problem } from "@/lib/docs/types";
import {
  createComment,
  listComments,
  resolveComment,
  type DriveComment,
} from "@/lib/google/api";

const PREFIX = "Website: ";

/** An open comment the site posted: by the service account, unresolved, and starting "Website: ". */
function isOurOpenComment(c: DriveComment): boolean {
  return c.author?.me === true && c.resolved !== true && c.content.startsWith(PREFIX);
}

/**
 * The comment texts to post (wanted and not already open, each once) and the
 * IDs of our open comments to resolve (their text is no longer wanted).
 * Comments by people, and our resolved ones, are never touched.
 */
export function planComments(
  problems: Problem[],
  existing: DriveComment[],
): { create: string[]; resolve: string[] } {
  const wanted = new Set(problems.map(commentText));
  const open = existing.filter(isOurOpenComment);
  const openTexts = new Set(open.map((c) => c.content));
  return {
    create: [...wanted].filter((text) => !openTexts.has(text)),
    resolve: open.filter((c) => !wanted.has(c.content)).map((c) => c.id),
  };
}

function logFailure(what: string, fileId: string, error: unknown): void {
  console.error(`Could not ${what} on Google Doc ${fileId}:`, error);
}

/**
 * Posts and resolves the site's comments on the doc to match `problems`.
 * Never throws: a failure is logged and swallowed, so it cannot hide that the
 * doc is blocked or break a page that is fine. Two runs at once for the same
 * doc may post a comment twice; that is accepted.
 */
export async function syncComments(fileId: string, problems: Problem[]): Promise<void> {
  let plan: { create: string[]; resolve: string[] };
  try {
    plan = planComments(problems, await listComments(fileId));
  } catch (error) {
    logFailure("read comments", fileId, error);
    return;
  }

  const { create, resolve } = plan;
  await Promise.all([
    ...create.map(async (text) => {
      try {
        await createComment(fileId, text);
      } catch (error) {
        logFailure("post a comment", fileId, error);
      }
    }),
    ...resolve.map(async (commentId) => {
      try {
        await resolveComment(fileId, commentId);
      } catch (error) {
        logFailure(`resolve comment ${commentId}`, fileId, error);
      }
    }),
  ]);
}
