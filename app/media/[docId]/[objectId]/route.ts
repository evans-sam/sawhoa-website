import { openDocImage } from "@/lib/content/media";

export const dynamic = "force-dynamic";

/** An inline image of a page or announcement doc, served through the site's service account. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string; objectId: string }> },
) {
  const { docId, objectId } = await params;
  return (await openDocImage(docId, objectId)) ?? new Response("Not found", { status: 404 });
}
