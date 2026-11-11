import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  GoogleError,
  downloadFile,
  getDoc,
  listEvents,
  listFolder,
  resolveComment,
} from "@/lib/google/api";

const TOKEN = "test-bearer-token-abc123";

vi.mock("@/lib/google/auth", () => ({
  getAccessToken: vi.fn(async () => TOKEN),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestAt(i: number): { url: URL; init: RequestInit } {
  const [input, init] = fetchMock.mock.calls[i];
  return { url: new URL(String(input)), init: init ?? {} };
}

function file(id: string) {
  return {
    id,
    name: `File ${id}`,
    mimeType: "application/pdf",
    createdTime: "2026-11-01T00:00:00Z",
  };
}

describe("listFolder", () => {
  test("follows nextPageToken and returns the files of every page", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ files: [file("a"), file("b")], nextPageToken: "page-2" }),
      )
      .mockResolvedValueOnce(json({ files: [file("c")] }));

    const files = await listFolder("folder-1");

    expect(files.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestAt(0).url;
    expect(first.searchParams.get("q")).toBe(
      "'folder-1' in parents and trashed = false",
    );
    expect(first.searchParams.get("fields")).toContain("nextPageToken");
    expect(first.searchParams.get("supportsAllDrives")).toBe("true");
    expect(first.searchParams.has("pageToken")).toBe(false);
    expect(requestAt(1).url.searchParams.get("pageToken")).toBe("page-2");
  });

  test("sends the bearer token, no-store and a timeout signal", async () => {
    fetchMock.mockResolvedValueOnce(json({ files: [] }));

    await listFolder("folder-1");

    const { init } = requestAt(0);
    expect(new Headers(init.headers).get("Authorization")).toBe(
      `Bearer ${TOKEN}`,
    );
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("listEvents", () => {
  test("follows nextPageToken and expands recurring entries", async () => {
    const event = (id: string) => ({
      id,
      start: { dateTime: "2026-11-12T19:00:00-07:00" },
      end: { dateTime: "2026-11-12T20:00:00-07:00" },
    });
    fetchMock
      .mockResolvedValueOnce(
        json({ items: [event("e1")], nextPageToken: "page-2" }),
      )
      .mockResolvedValueOnce(json({ items: [event("e2")] }));
    const timeMin = new Date("2026-11-11T00:00:00Z");
    const timeMax = new Date("2026-12-11T00:00:00Z");

    const events = await listEvents("cal@group.calendar.google.com", timeMin, timeMax);

    expect(events.map((e) => e.id)).toEqual(["e1", "e2"]);
    const first = requestAt(0).url;
    expect(first.pathname).toBe(
      "/calendar/v3/calendars/cal%40group.calendar.google.com/events",
    );
    expect(first.searchParams.get("singleEvents")).toBe("true");
    expect(first.searchParams.get("orderBy")).toBe("startTime");
    expect(first.searchParams.get("timeMin")).toBe(timeMin.toISOString());
    expect(first.searchParams.get("timeMax")).toBe(timeMax.toISOString());
    const second = requestAt(1).url;
    expect(second.searchParams.get("pageToken")).toBe("page-2");
    expect(second.searchParams.get("singleEvents")).toBe("true");
  });
});

describe("getDoc", () => {
  test("reads the doc with suggestions excluded", async () => {
    fetchMock.mockResolvedValueOnce(json({ documentId: "doc-1" }));

    await expect(getDoc("doc-1")).resolves.toEqual({ documentId: "doc-1" });

    const { url } = requestAt(0);
    expect(url.pathname).toBe("/v1/documents/doc-1");
    expect(url.searchParams.get("suggestionsViewMode")).toBe(
      "PREVIEW_WITHOUT_SUGGESTIONS",
    );
  });

  test("rejects with GoogleError on a 500 without revealing the token", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        { error: { code: 500, message: `Internal error for Bearer ${TOKEN}` } },
        500,
      ),
    );

    const error = await getDoc("doc-1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GoogleError);
    expect((error as GoogleError).status).toBe(500);
    expect((error as GoogleError).message).not.toContain(TOKEN);
    expect((error as GoogleError).message).toContain("500");
    expect((error as GoogleError).message).toContain("Internal error");
  });
});

describe("downloadFile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fake timers do not drive AbortSignal.timeout; route it through the faked
    // setTimeout so a whole-request timeout would show up in these tests too.
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("timed out", "TimeoutError")),
        ms,
      );
      return controller.signal;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  test("does not abort the body once the headers have arrived", async () => {
    fetchMock.mockResolvedValueOnce(new Response("pdf bytes"));

    const res = await downloadFile("file-1");
    const { url, init } = requestAt(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(url.searchParams.get("alt")).toBe("media");
    expect(init.signal?.aborted).toBe(false);
    await expect(res.text()).resolves.toBe("pdf bytes");
  });

  test("aborts at 10 s when the headers never arrive", async () => {
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const download = downloadFile("file-1").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(requestAt(0).init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await download;
    expect(requestAt(0).init.signal?.aborted).toBe(true);
    expect((error as Error).name).toBe("TimeoutError");
  });
});

describe("resolveComment", () => {
  test("posts a resolve reply to the comment", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "reply-1" }));

    await resolveComment("file-1", "comment-1");

    const { url, init } = requestAt(0);
    expect(init.method).toBe("POST");
    expect(url.pathname).toBe(
      "/drive/v3/files/file-1/comments/comment-1/replies",
    );
    expect(url.searchParams.get("fields")).toBeTruthy();
    expect(JSON.parse(String(init.body))).toEqual({
      action: "resolve",
      content: "Fixed. Thank you.",
    });
  });
});
