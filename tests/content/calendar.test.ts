import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadBanners, loadEvents } from "@/lib/content/calendar";
import { GoogleError, listEvents, type CalendarEvent } from "@/lib/google/api";
import { ids } from "./fixtures";

vi.mock("@/content/google.json", async () => ({ default: (await import("./fixtures")).ids }));
vi.mock("@/lib/google/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/api")>()),
  listEvents: vi.fn(),
}));

const NOW = new Date("2026-11-11T19:00:00Z"); // Wed Nov 11, 2026, 12:00 PM in Denver

function timed(id: string, summary: string, start: string, end: string): CalendarEvent {
  return { id, status: "confirmed", summary, start: { dateTime: start }, end: { dateTime: end } };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("loadBanners", () => {
  test("lists the banner calendar from a day before now to a day after, and keeps the active ones", async () => {
    vi.mocked(listEvents).mockResolvedValue([
      timed("b-1", "Water off", "2026-11-11T15:00:00Z", "2026-11-11T23:00:00Z"),
      timed("b-2", "Tomorrow", "2026-11-12T15:00:00Z", "2026-11-12T23:00:00Z"),
    ]);

    expect(await loadBanners()).toEqual([{ id: "b-1", text: "Water off" }]);
    expect(listEvents).toHaveBeenCalledExactlyOnceWith(
      ids.calendars.banner,
      new Date("2026-11-10T19:00:00Z"),
      new Date("2026-11-12T19:00:00Z"),
    );
  });

  test("rejects when the calendar cannot be listed", async () => {
    vi.mocked(listEvents).mockRejectedValue(new GoogleError(503, "Calendar unavailable"));
    await expect(loadBanners()).rejects.toBeInstanceOf(GoogleError);
  });
});

describe("loadEvents", () => {
  test("lists the events calendar from now to six months ahead, soonest first", async () => {
    vi.mocked(listEvents).mockResolvedValue([
      timed("e-2", "Board meeting", "2026-12-01T01:00:00Z", "2026-12-01T02:00:00Z"),
      timed("e-1", "Yard sale", "2026-11-14T16:00:00Z", "2026-11-14T20:00:00Z"),
    ]);

    const events = await loadEvents();

    expect(events.map((e) => e.id)).toEqual(["e-1", "e-2"]);
    const [calendarId, from, until] = vi.mocked(listEvents).mock.calls[0];
    expect(calendarId).toBe(ids.calendars.events);
    expect(from).toEqual(NOW);
    expect(until.getUTCFullYear()).toBe(2027);
    expect(until.getUTCMonth()).toBe(4); // May
    expect(until.getUTCDate()).toBe(11);
  });

  test("refuses to call Google when the calendar ID is missing", async () => {
    ids.calendars.events = "";
    try {
      await expect(loadEvents()).rejects.toThrow(/calendars\.events.*npm run content:discover/);
      expect(listEvents).not.toHaveBeenCalled();
    } finally {
      ids.calendars.events = "events@group.calendar.google.com";
    }
  });
});
