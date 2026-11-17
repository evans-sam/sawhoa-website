import type { Problem } from "@/lib/docs/types";

/**
 * A Google Doc has something the website can't show. Thrown while rendering so
 * Next.js keeps serving the last good version of the page.
 */
export class BlockedError extends Error {
  docTitle: string;
  docUrl: string;
  problems: Problem[];

  constructor(docId: string, docTitle: string, problems: Problem[]) {
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    const kinds = [...new Set(problems.map((p) => p.kind))].join(", ");
    super(`Blocked: "${docTitle}" (${docUrl}): ${kinds}`);
    this.name = "BlockedError";
    this.docTitle = docTitle;
    this.docUrl = docUrl;
    this.problems = problems;
  }
}
