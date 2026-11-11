import google from "@/content/google.json";
import { FILE_ID, googleId } from "@/lib/content/ids";
import { embeddedObject, objectKind } from "@/lib/docs/check";
import { downloadFile, getDoc, getFileMeta, GoogleError } from "@/lib/google/api";

const PDF = "application/pdf";
const GOOGLE_DOC = "application/vnd.google-apps.document";
const PDF_CACHE = "public, max-age=300, s-maxage=3600";
/** A Docs object ID changes when the image is replaced, so the bytes never change. */
const IMAGE_CACHE = "public, max-age=86400, s-maxage=604800, immutable";
const IMAGE_TIMEOUT_MS = 10_000;

/** Google statuses that mean "this visitor gets nothing here", not "Google is unwell". */
const NOT_SERVABLE = new Set([400, 403, 404]);

/** The call's result, or null when Google answers that the file is not there for us. */
async function unlessMissing<T>(call: Promise<T>): Promise<T | null> {
  try {
    return await call;
  } catch (error) {
    if (error instanceof GoogleError && NOT_SERVABLE.has(error.status)) return null;
    throw error;
  }
}

/**
 * Headers for a streamed body: the type given, nosniff, the cache policy, and
 * the upstream length when it describes the bytes being passed on (fetch
 * decompresses, so a compressed upstream's length does not).
 */
function streamHeaders(upstream: Response, contentType: string, cacheControl: string): Headers {
  const headers = new Headers({
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl,
  });
  const length = upstream.headers.get("Content-Length");
  const encoding = upstream.headers.get("Content-Encoding");
  if (length && (!encoding || encoding === "identity")) headers.set("Content-Length", length);
  return headers;
}

/**
 * `inline` with the name twice: a plain printable-ASCII `filename` with quotes
 * and backslashes removed, and an RFC 5987 `filename*` with the real name.
 */
function contentDisposition(name: string): string {
  const plain = name.replace(/[^\x20-\x7e]|["\\]/g, "");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${plain}"; filename*=UTF-8''${encoded}`;
}

/**
 * The PDF with this Drive ID, streamed from Drive, or null when the site does
 * not serve it: not a Drive file ID, not a PDF, trashed, outside the
 * Newsletters and Documents folders, or unknown to Google.
 */
export async function openPdf(fileId: string): Promise<Response | null> {
  if (!FILE_ID.test(fileId)) return null;
  const folders = [googleId("folders", "newsletters"), googleId("folders", "documents")];

  const file = await unlessMissing(getFileMeta(fileId));
  if (!file || file.mimeType !== PDF || file.trashed === true) return null;
  if (!file.parents?.some((parent) => folders.includes(parent))) return null;

  const upstream = await unlessMissing(downloadFile(fileId));
  if (!upstream) return null;

  const headers = streamHeaders(upstream, PDF, PDF_CACHE);
  headers.set("Content-Disposition", contentDisposition(file.name));
  return new Response(upstream.body, { status: 200, headers });
}

/** The six page docs, or a Google Doc in the Announcements folder that is not trashed. */
async function isServableDoc(docId: string): Promise<boolean> {
  if (Object.values(google.pages).includes(docId)) return true;
  const folderId = googleId("folders", "announcements");
  const file = await unlessMissing(getFileMeta(docId));
  return (
    file !== null &&
    file.mimeType === GOOGLE_DOC &&
    file.trashed !== true &&
    file.parents?.includes(folderId) === true
  );
}

function imageFailure(docId: string, reason: string): Error {
  // The image address is signed, so it is never put in the message.
  return new Error(`Image fetch for Google Doc ${docId} failed (${reason})`);
}

/**
 * GETs the image address; the time limit covers the wait for headers only, so
 * the body can then be streamed for as long as it takes.
 */
async function fetchImage(uri: string, docId: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    IMAGE_TIMEOUT_MS,
  );
  try {
    return await fetch(uri, { cache: "no-store", signal: controller.signal });
  } catch (error) {
    throw imageFailure(docId, error instanceof Error ? error.name : "network error");
  } finally {
    clearTimeout(timer);
  }
}

/** A raster image type the site passes on; SVG is refused because it can carry script. */
function servableImageType(contentType: string | null): string | null {
  const type = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  return type.startsWith("image/") && type !== "image/svg+xml" ? contentType : null;
}

/**
 * The inline image `objectId` of a page doc or an announcement doc, streamed
 * from Google, or null when the site does not serve it: a doc outside those,
 * an object that is not a plain image (a drawing or chart), an unknown object,
 * an image address answering a client error, or a non-image response.
 * Throws on any other Google or image-fetch failure.
 */
export async function openDocImage(docId: string, objectId: string): Promise<Response | null> {
  if (!FILE_ID.test(docId)) return null;
  if (!(await isServableDoc(docId))) return null;

  const doc = await unlessMissing(getDoc(docId));
  if (!doc || !Object.hasOwn(doc.inlineObjects ?? {}, objectId)) return null;
  const object = embeddedObject(doc, objectId);
  const uri = object?.imageProperties?.contentUri;
  if (objectKind(object) !== "image" || !uri) return null;

  const upstream = await fetchImage(uri, docId);
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => {});
    if (upstream.status >= 400 && upstream.status < 500) return null;
    throw imageFailure(docId, `status ${upstream.status}`);
  }
  const contentType = servableImageType(upstream.headers.get("Content-Type"));
  if (!contentType) {
    await upstream.body?.cancel().catch(() => {});
    return null;
  }
  return new Response(upstream.body, {
    status: 200,
    headers: streamHeaders(upstream, contentType, IMAGE_CACHE),
  });
}
