import { describe, expect, test } from "vitest";
import { activeBanners, upcomingEvents } from "@/lib/calendar/select";
import type { CalendarEvent } from "@/lib/google/api";

/** A timed entry; times are RFC 3339, as the Calendar API returns them. */
function timed(
  id: string,
  summary: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent {
  return { id, status: "confirmed", summary, start: { dateTime: start }, end: { dateTime: end }, ...extra };
}

/** An all-day entry; `end` is exclusive, as in the Calendar API. */
function allDay(
  id: string,
  summary: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent {
  return { id, status: "confirmed", summary, start: { date: start }, end: { date: end }, ...extra };
}

const NOW = new Date("2026-11-11T19:00:00Z"); // Wed Nov 11, 2026, 12:00 PM in Denver
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString();

describe("activeBanners", () => {
  test("an all-day banner is active for the whole Denver day, and not after it", () => {
    const banner = allDay("b1", "Pool closed", "2026-11-11", "2026-11-12");
    // 11:30 PM Nov 11 in Denver
    expect(activeBanners([banner], new Date("2026-11-12T06:30:00Z"))).toEqual([
      { id: "b1", text: "Pool closed" },
    ]);
    // 12:30 AM Nov 12 in Denver
    expect(activeBanners([banner], new Date("2026-11-12T07:30:00Z"))).toEqual([]);
  });

  test("an all-day banner is not active the Denver evening before it", () => {
    const banner = allDay("b1", "Pool closed", "2026-11-11", "2026-11-12");
    // 11:30 PM Nov 10 in Denver, already Nov 11 in UTC
    expect(activeBanners([banner], new Date("2026-11-11T06:30:00Z"))).toEqual([]);
  });

  test("an all-day banner on the 25-hour fall-back day lasts until Denver midnight", () => {
    const banner = allDay("b1", "Clocks go back", "2026-11-01", "2026-11-02");
    // 11:30 PM Nov 1 in Denver (MST), 24.5 hours after midnight MDT
    expect(activeBanners([banner], new Date("2026-11-02T06:30:00Z"))).toHaveLength(1);
    // 12:30 AM Nov 2 in Denver
    expect(activeBanners([banner], new Date("2026-11-02T07:30:00Z"))).toEqual([]);
  });

  test("a timed banner that ended a minute ago, or starts in a minute, is not active", () => {
    const ended = timed("b1", "Water off", minutes(-61), minutes(-1));
    const upcoming = timed("b2", "Road work", minutes(1), minutes(60));
    expect(activeBanners([ended, upcoming], NOW)).toEqual([]);
  });

  test("a timed banner is active from its start, up to but not at its end", () => {
    const starting = timed("b1", "Starts now", NOW.toISOString(), minutes(60));
    const ending = timed("b2", "Ends now", minutes(-60), NOW.toISOString());
    expect(activeBanners([starting, ending], NOW).map((b) => b.id)).toEqual(["b1"]);
  });

  test("overlapping banners all return, earliest start first", () => {
    const later = timed("later", "Road work", minutes(-30), minutes(30));
    const earlier = timed("earlier", "Water off", minutes(-90), minutes(90));
    const allDayToday = allDay("all-day", "Trash pickup delayed", "2026-11-11", "2026-11-12");
    expect(activeBanners([later, earlier, allDayToday], NOW).map((b) => b.id)).toEqual([
      "all-day",
      "earlier",
      "later",
    ]);
  });

  test("an all-day banner started yesterday sorts before a timed one started today", () => {
    const timedToday = timed("timed", "Road work", minutes(-30), minutes(30));
    const allWeek = allDay("week", "Pool closed", "2026-11-10", "2026-11-14");
    expect(activeBanners([timedToday, allWeek], NOW).map((b) => b.id)).toEqual(["week", "timed"]);
  });

  test("blank-summary and cancelled entries are skipped", () => {
    expect(
      activeBanners(
        [
          timed("b1", "   ", minutes(-10), minutes(10)),
          timed("b2", "Water off", minutes(-10), minutes(10), { status: "cancelled" }),
          { ...timed("b3", "", minutes(-10), minutes(10)), summary: undefined },
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  test("the summary is trimmed and the description becomes plain-text detail", () => {
    const banner = timed("b1", "  Potluck  ", minutes(-10), minutes(10), {
      description: "<b>Bring</b> chairs<br>and snacks",
    });
    expect(activeBanners([banner], NOW)).toEqual([
      { id: "b1", text: "Potluck", detail: "Bring chairs and snacks" },
    ]);
  });

  test("a description that is only tags or whitespace gives no detail", () => {
    const banner = timed("b1", "Potluck", minutes(-10), minutes(10), { description: "<br> <p></p>" });
    expect(activeBanners([banner], NOW)).toEqual([{ id: "b1", text: "Potluck" }]);
  });
});

describe("plain-text descriptions", () => {
  test.each([
    ["<b>Bring</b> chairs<br>and snacks", "Bring chairs and snacks"],
    ["<p>Line one</p><p>Line two</p>", "Line one Line two"],
    ['See <a href="https://sawhoa.com">the site</a>.', "See the site."],
    ["Fish &amp; chips &lt;3 &quot;yum&quot; &#39;ok&#39; &#x2014; done&nbsp;now", "Fish & chips <3 \"yum\" 'ok' — done now"],
    ["Plain\ntext\n\nwith   spaces", "Plain text with spaces"],
    ["Ages 5 < 10 are free", "Ages 5 < 10 are free"],
    ["Unknown &copy; &constructor; &#0; stay", "Unknown &copy; &constructor; &#0; stay"],
  ])("%j becomes %j", (description, plain) => {
    const event = timed("e1", "Event", minutes(-10), minutes(10), { description });
    expect(upcomingEvents([event], NOW)[0].description).toBe(plain);
  });
});

describe("upcomingEvents", () => {
  test("an event that started an hour ago and ends in an hour is still listed", () => {
    expect(upcomingEvents([timed("e1", "Board meeting", minutes(-60), minutes(60))], NOW)).toHaveLength(1);
  });

  test("an event that has ended is not listed; one ending exactly now is not either", () => {
    expect(
      upcomingEvents(
        [
          timed("e1", "Yesterday", minutes(-1500), minutes(-1440)),
          timed("e2", "Just ended", minutes(-60), NOW.toISOString()),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  test("an all-day event is listed through its last Denver day", () => {
    const event = allDay("e1", "Garage sale", "2026-11-10", "2026-11-12");
    expect(upcomingEvents([event], new Date("2026-11-12T06:30:00Z"))).toHaveLength(1);
    expect(upcomingEvents([event], new Date("2026-11-12T07:30:00Z"))).toEqual([]);
  });

  test("events are listed soonest first", () => {
    const events = [
      timed("dec", "Holiday party", "2026-12-12T18:00:00-07:00", "2026-12-12T21:00:00-07:00"),
      allDay("nov14", "Garage sale", "2026-11-14", "2026-11-15"),
      timed("nov14-pm", "Potluck", "2026-11-14T18:30:00-07:00", "2026-11-14T20:00:00-07:00"),
      timed("nov13", "Board meeting", "2026-11-13T19:00:00-07:00", "2026-11-13T20:00:00-07:00"),
    ];
    expect(upcomingEvents(events, NOW).map((e) => e.id)).toEqual(["nov13", "nov14", "nov14-pm", "dec"]);
  });

  test("blank-summary and cancelled entries are skipped", () => {
    expect(
      upcomingEvents(
        [
          timed("e1", "", minutes(60), minutes(120)),
          allDay("e2", "Garage sale", "2026-11-14", "2026-11-15", { status: "cancelled" }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  test("title is trimmed; blank location and description are left out", () => {
    const event = timed("e1", " Potluck ", minutes(60), minutes(120), {
      location: "  ",
      description: " ",
    });
    expect(upcomingEvents([event], NOW)[0]).toEqual({
      id: "e1",
      title: "Potluck",
      when: "Wed, Nov 11, 2026, 1:00 – 2:00 PM",
    });
  });

  test("location and description are passed through as plain text", () => {
    const event = timed("e1", "Potluck", minutes(60), minutes(120), {
      location: " Clubhouse, 100 Main St ",
      description: "<b>Bring</b> chairs<br>and snacks",
    });
    expect(upcomingEvents([event], NOW)[0]).toMatchObject({
      location: "Clubhouse, 100 Main St",
      description: "Bring chairs and snacks",
    });
  });

  describe("when", () => {
    const when = (event: CalendarEvent) => upcomingEvents([event], NOW)[0].when;

    test("a timed event on one day, after the fall-back to MST", () => {
      expect(when(timed("e1", "Potluck", "2026-11-15T01:30:00Z", "2026-11-15T03:00:00Z"))).toBe(
        "Sat, Nov 14, 2026, 6:30 – 8:00 PM",
      );
    });

    test("a timed event from morning into the afternoon", () => {
      expect(when(timed("e1", "Cleanup", "2026-11-14T09:00:00-07:00", "2026-11-14T13:00:00-07:00"))).toBe(
        "Sat, Nov 14, 2026, 9:00 AM – 1:00 PM",
      );
    });

    test("a timed event that spans two days", () => {
      expect(when(timed("e1", "Party", "2026-11-14T18:30:00-07:00", "2026-11-15T01:00:00-07:00"))).toBe(
        "Sat, Nov 14, 2026, 6:30 PM – Sun, Nov 15, 2026, 1:00 AM",
      );
    });

    test("a timed event across the DST change shows each end in its own Denver time", () => {
      const now = new Date("2026-10-31T12:00:00Z");
      // 1:00 AM MDT to 3:00 AM MST on Sun Nov 1: three real hours, two on the clock
      const event = timed("e1", "Night shift", "2026-11-01T07:00:00Z", "2026-11-01T10:00:00Z");
      expect(upcomingEvents([event], now)[0].when).toBe("Sun, Nov 1, 2026, 1:00 – 3:00 AM");
      // 11:00 PM MDT Sat Oct 31 to 1:30 AM MST Sun Nov 1
      const overnight = timed("e2", "Halloween", "2026-10-31T23:00:00-06:00", "2026-11-01T01:30:00-07:00");
      expect(upcomingEvents([overnight], now)[0].when).toBe(
        "Sat, Oct 31, 2026, 11:00 PM – Sun, Nov 1, 2026, 1:30 AM",
      );
    });

    test("a timed event that starts and ends at the same moment", () => {
      expect(when(timed("e1", "Deadline", "2026-11-14T17:00:00-07:00", "2026-11-14T17:00:00-07:00"))).toBe(
        "Sat, Nov 14, 2026, 5:00 PM",
      );
    });

    test("an all-day event", () => {
      expect(when(allDay("e1", "Garage sale", "2026-11-14", "2026-11-15"))).toBe("Sat, Nov 14, 2026");
    });

    test("an all-day event on the fall-back day", () => {
      const now = new Date("2026-10-31T12:00:00Z");
      const event = allDay("e1", "Clocks go back", "2026-11-01", "2026-11-02");
      expect(upcomingEvents([event], now)[0].when).toBe("Sun, Nov 1, 2026");
    });

    test("a multi-day all-day event (end date exclusive)", () => {
      expect(when(allDay("e1", "Garage sale", "2026-11-14", "2026-11-17"))).toBe("Nov 14 – 16, 2026");
    });

    test("a multi-day all-day event across months and years", () => {
      expect(when(allDay("e1", "Lights", "2026-11-30", "2026-12-03"))).toBe("Nov 30 – Dec 2, 2026");
      expect(when(allDay("e2", "Break", "2026-12-30", "2027-01-03"))).toBe("Dec 30, 2026 – Jan 2, 2027");
    });

    test("uses plain spaces, never narrow or thin ones", () => {
      const text = when(timed("e1", "Potluck", "2026-11-15T01:30:00Z", "2026-11-15T03:00:00Z"));
      expect(text).not.toMatch(/[   ]/);
    });
  });
});
