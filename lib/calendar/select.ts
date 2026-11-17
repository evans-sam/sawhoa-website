/**
 * Picks the notice banners showing now and the upcoming events from Google
 * Calendar entries, with every date read and shown in Denver time.
 *
 * Times are only compared as instants or formatted with Intl.DateTimeFormat;
 * nothing assumes a day is 24 hours long, so DST changes need no special case.
 */
import { settings } from "@/content/settings";
import type { CalendarEvent } from "@/lib/google/api";

export type Banner = { id: string; text: string; detail?: string };

export type SiteEvent = {
  id: string;
  title: string;
  /** Formatted in Denver time, e.g. "Sat, Nov 14, 2026, 6:30 – 8:00 PM". */
  when: string;
  location?: string;
  description?: string;
};

/**
 * A usable entry: not cancelled, with a title. An all-day entry has calendar
 * dates (YYYY-MM-DD, `endDate` exclusive as in the Calendar API); a timed one
 * has instants.
 */
type Entry = { event: CalendarEvent; title: string } & (
  | { allDay: true; startDate: string; endDate: string }
  | { allDay: false; start: Date; end: Date }
);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const TIME_ZONE = settings.timeZone;

const DATE_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const DAY_RANGE = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** The calendar date (YYYY-MM-DD) in Denver at an instant. */
function denverDate(at: Date): string {
  const parts = Object.fromEntries(DATE_PARTS.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function instant(dateTime: string | undefined): Date | undefined {
  const at = dateTime === undefined ? undefined : new Date(dateTime);
  return at && !Number.isNaN(at.getTime()) ? at : undefined;
}

/** The entry, or nothing when it is cancelled, has no title, or has unreadable times. */
function toEntry(event: CalendarEvent): Entry | undefined {
  const title = event.summary?.trim() ?? "";
  if (event.status === "cancelled" || !title) return undefined;
  if (event.start.date !== undefined) {
    const { date: startDate } = event.start;
    const { date: endDate } = event.end;
    if (!DATE_ONLY.test(startDate) || !endDate || !DATE_ONLY.test(endDate)) return undefined;
    return { event, title, allDay: true, startDate, endDate };
  }
  const start = instant(event.start.dateTime);
  const end = instant(event.end.dateTime);
  return start && end ? { event, title, allDay: false, start, end } : undefined;
}

function entries(events: CalendarEvent[]): Entry[] {
  return events.flatMap((e) => toEntry(e) ?? []);
}

/** Whether the entry has not ended yet: timed end after `now`, or all-day (exclusive) end after `today`. */
function notEnded(entry: Entry, now: Date, today: string): boolean {
  return entry.allDay ? today < entry.endDate : now < entry.end;
}

/** Whether the entry has started: timed start at or before `now`, or all-day start on or before `today`. */
function started(entry: Entry, now: Date, today: string): boolean {
  return entry.allDay ? entry.startDate <= today : entry.start <= now;
}

/** The Denver date an entry starts on, and for a timed entry the instant. */
function startKey(entry: Entry): { date: string; at: number } {
  return entry.allDay
    ? { date: entry.startDate, at: -Infinity }
    : { date: denverDate(entry.start), at: entry.start.getTime() };
}

/**
 * Earliest start first. An all-day entry starts at Denver midnight on its
 * date, so it comes before any timed entry on that date.
 */
function byStart(a: Entry, b: Entry): number {
  const x = startKey(a);
  const y = startKey(b);
  if (x.date !== y.date) return x.date < y.date ? -1 : 1;
  return x.at === y.at ? 0 : x.at < y.at ? -1 : 1;
}

const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

/** Decodes the named entities above and numeric ones; anything else is left as written. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES.get(name.toLowerCase()) ?? whole;
  });
}

/** Tags that separate words: a line break, or the edge of a block. */
const BREAKING_TAG = /<\/?(br|p|div|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|hr)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

/**
 * Calendar descriptions as plain text: Google stores them as HTML when edited
 * in the web app. Tags are removed (line breaks and blocks become spaces),
 * entities decoded and whitespace collapsed. Blank becomes undefined.
 */
function plainText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = decodeEntities(html.replace(BREAKING_TAG, " ").replace(ANY_TAG, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

/** Intl puts thin and narrow no-break spaces around "–" and before "AM"/"PM"; the site uses plain ones. */
function plainSpaces(text: string): string {
  return text.replace(/[   ]/g, " ");
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

/**
 * A calendar date as an instant inside that date in Denver: noon UTC is 5 or
 * 6 AM in Denver, so formatting it in Denver shows the same date.
 */
function dateInstant(date: string): Date {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** The calendar date one day earlier; calendar arithmetic on dates, not on instants. */
function dayBefore(date: string): string {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * "Sat, Nov 14, 2026, 6:30 – 8:00 PM", "Sat, Nov 14, 2026, 6:30 PM – Sun, Nov 15, 2026, 1:00 AM",
 * "Sat, Nov 14, 2026" (all-day) or "Nov 14 – 16, 2026" (all-day over several days).
 */
function formatWhen(entry: Entry): string {
  if (!entry.allDay) {
    const { start, end } = entry;
    return plainSpaces(end > start ? DATE_TIME.formatRange(start, end) : DATE_TIME.format(start));
  }
  const { startDate, endDate } = entry;
  const lastDay = dayBefore(endDate);
  if (lastDay <= startDate) return plainSpaces(DAY.format(dateInstant(startDate)));
  return plainSpaces(DAY_RANGE.formatRange(dateInstant(startDate), dateInstant(lastDay)));
}

/** The banners showing at `now`, earliest start first. */
export function activeBanners(events: CalendarEvent[], now: Date): Banner[] {
  const today = denverDate(now);
  return entries(events)
    .filter((e) => started(e, now, today) && notEnded(e, now, today))
    .sort(byStart)
    .map((e) => {
      const detail = plainText(e.event.description);
      return { id: e.event.id, text: e.title, ...(detail && { detail }) };
    });
}

/** The events that have not ended at `now` (including ones under way), soonest first. */
export function upcomingEvents(events: CalendarEvent[], now: Date): SiteEvent[] {
  const today = denverDate(now);
  return entries(events)
    .filter((e) => notEnded(e, now, today))
    .sort(byStart)
    .map((e) => {
      const location = e.event.location?.trim();
      const description = plainText(e.event.description);
      return {
        id: e.event.id,
        title: e.title,
        when: formatWhen(e),
        ...(location && { location }),
        ...(description && { description }),
      };
    });
}
