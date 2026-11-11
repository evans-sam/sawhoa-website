import { getAccessToken } from "@/lib/google/auth";

const DOCS = "https://docs.googleapis.com/v1/documents";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const CALENDAR = "https://www.googleapis.com/calendar/v3/calendars";
const TIMEOUT_MS = 10_000;

const FILE_FIELDS = "id,name,mimeType,createdTime,parents,trashed,size";

export class GoogleError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleError";
    this.status = status;
  }
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  parents?: string[];
  trashed?: boolean;
  size?: string;
};

export type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

export type DriveComment = {
  id: string;
  content: string;
  resolved?: boolean;
  author?: { me?: boolean };
};

type Params = Record<string, string>;

function buildUrl(base: string, path: string, params: Params): URL {
  const url = new URL(base + path);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return url;
}

/** Drive URLs always carry `fields` and `supportsAllDrives`. */
function driveUrl(path: string, fields: string, params: Params = {}): URL {
  return buildUrl(DRIVE, path, { ...params, fields, supportsAllDrives: "true" });
}

/** Sends an authorised request; throws GoogleError on a non-2xx response. */
async function send(url: URL, method = "GET", body?: unknown): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const data = (await res.json()) as { error?: { message?: unknown } };
      if (typeof data.error?.message === "string") detail = `: ${data.error.message}`;
    } catch {
      // Body was not JSON; the status alone is reported.
    }
    const message = `${method} ${url.origin}${url.pathname} failed with ${res.status}${detail}`;
    throw new GoogleError(res.status, message.replaceAll(token, "[token]"));
  }
  return res;
}

async function getJson<T>(url: URL): Promise<T> {
  return (await send(url)).json() as Promise<T>;
}

/** Fetches every page of a list endpoint, following `nextPageToken`. */
async function getAllPages<T, K extends string>(
  makeUrl: (pageToken?: string) => URL,
  key: K,
): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getJson<{ nextPageToken?: string } & { [P in K]?: T[] }>(
      makeUrl(pageToken),
    );
    all.push(...(page[key] ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

function withPageToken(params: Params, pageToken?: string): Params {
  return pageToken ? { ...params, pageToken } : params;
}

/** The Docs API document, with suggested edits left out. */
export async function getDoc(docId: string): Promise<unknown> {
  return getJson(
    buildUrl(DOCS, `/${encodeURIComponent(docId)}`, {
      suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    }),
  );
}

/** Every file directly in a folder that is not in the trash. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const q = `'${folderId.replace(/[\\']/g, "\\$&")}' in parents and trashed = false`;
  return getAllPages<DriveFile, "files">(
    (pageToken) =>
      driveUrl("", `nextPageToken,files(${FILE_FIELDS})`, withPageToken(
        { q, pageSize: "1000", includeItemsFromAllDrives: "true" },
        pageToken,
      )),
    "files",
  );
}

export async function getFileMeta(fileId: string): Promise<DriveFile> {
  return getJson(driveUrl(`/${encodeURIComponent(fileId)}`, FILE_FIELDS));
}

/** The file's content as an unread Response, for streaming to the visitor. */
export async function downloadFile(fileId: string): Promise<Response> {
  return send(driveUrl(`/${encodeURIComponent(fileId)}`, "id", { alt: "media" }));
}

/** Every entry between the two times, recurring entries expanded, in start order. */
export async function listEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  return getAllPages<CalendarEvent, "items">(
    (pageToken) =>
      buildUrl(CALENDAR, `/${encodeURIComponent(calendarId)}/events`, withPageToken(
        {
          singleEvents: "true",
          orderBy: "startTime",
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          maxResults: "2500",
        },
        pageToken,
      )),
    "items",
  );
}

export async function listComments(fileId: string): Promise<DriveComment[]> {
  return getAllPages<DriveComment, "comments">(
    (pageToken) =>
      driveUrl(
        `/${encodeURIComponent(fileId)}/comments`,
        "nextPageToken,comments(id,content,resolved,author(me))",
        withPageToken({ pageSize: "100" }, pageToken),
      ),
    "comments",
  );
}

export async function createComment(fileId: string, content: string): Promise<void> {
  await send(driveUrl(`/${encodeURIComponent(fileId)}/comments`, "id"), "POST", {
    content,
  });
}

/** Resolves a comment by posting a reply that marks it resolved. */
export async function resolveComment(fileId: string, commentId: string): Promise<void> {
  await send(
    driveUrl(
      `/${encodeURIComponent(fileId)}/comments/${encodeURIComponent(commentId)}/replies`,
      "id",
    ),
    "POST",
    { action: "resolve", content: "Fixed. Thank you." },
  );
}
