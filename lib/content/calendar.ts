import { cache } from "react";
import { settings } from "@/content/settings";
import { activeBanners, upcomingEvents, type Banner, type SiteEvent } from "@/lib/calendar/select";
import { googleId } from "@/lib/content/ids";
import { listEvents } from "@/lib/google/api";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The banners showing now. */
export const loadBanners = cache(async (): Promise<Banner[]> => {
  const calendarId = googleId("calendars", "banner");
  const now = new Date();
  const events = await listEvents(
    calendarId,
    new Date(now.getTime() - DAY_MS),
    new Date(now.getTime() + DAY_MS),
  );
  return activeBanners(events, now);
});

/** The events from now to `settings.eventsMonthsAhead` months ahead, soonest first. */
export const loadEvents = cache(async (): Promise<SiteEvent[]> => {
  const calendarId = googleId("calendars", "events");
  const now = new Date();
  const until = new Date(now);
  until.setUTCMonth(until.getUTCMonth() + settings.eventsMonthsAhead);
  return upcomingEvents(await listEvents(calendarId, now, until), now);
});
