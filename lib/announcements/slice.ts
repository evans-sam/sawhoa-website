import type { SliceSettings } from "@/content/settings";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Picks the announcements shown on the home page, newest first.
 *
 * Every post younger than `guaranteedDays` is shown. Beyond that, posts
 * younger than `currentDays` fill up to `softMaximum`, and older posts top
 * the list up to `minimum`.
 */
export function selectHomeSlice<T extends { postedAt: Date }>(
  posts: T[],
  now: Date,
  s: SliceSettings,
): T[] {
  const newestFirst = [...posts].sort(
    (a, b) => b.postedAt.getTime() - a.postedAt.getTime(),
  );
  const youngerThan = (days: number) =>
    newestFirst.filter(
      (p) => now.getTime() - p.postedAt.getTime() < days * DAY_MS,
    ).length;

  const guaranteedCount = youngerThan(s.guaranteedDays);
  const currentCount = youngerThan(s.currentDays);
  const n = Math.max(
    guaranteedCount,
    Math.min(currentCount, s.softMaximum),
    Math.min(newestFirst.length, s.minimum),
  );
  return newestFirst.slice(0, n);
}
