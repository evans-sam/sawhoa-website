import { openPdf } from "@/lib/content/media";

export const dynamic = "force-dynamic";

/** A Newsletters or Documents PDF, served through the site's service account. */
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return (await openPdf(fileId)) ?? new Response("Not found", { status: 404 });
}
