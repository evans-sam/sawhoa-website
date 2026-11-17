import { describe, expect, test } from "vitest";
import { settings } from "@/content/settings";
import { selectHomeSlice } from "@/lib/announcements/slice";

const now = new Date("2026-11-11T18:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}

function postsAged(...ages: number[]) {
  return ages.map((age) => ({ id: `aged-${age}`, postedAt: daysAgo(age) }));
}

function slice(posts: { id: string; postedAt: Date }[]) {
  return selectHomeSlice(posts, now, settings.slice);
}

function expectNewestFirst(result: { postedAt: Date }[]) {
  for (let i = 1; i < result.length; i++) {
    expect(result[i - 1].postedAt.getTime()).toBeGreaterThanOrEqual(
      result[i].postedAt.getTime(),
    );
  }
}

describe("selectHomeSlice", () => {
  test("shows every post from the guaranteed window, even past the soft maximum", () => {
    const result = slice(postsAged(0, 1, 2, 3, 4, 5, 6));
    expect(result).toHaveLength(7);
    expectNewestFirst(result);
  });

  test("fills up to the soft maximum with current posts", () => {
    const result = slice(postsAged(1, 2, 20, 30, 40, 50, 60, 80));
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.id)).toEqual([
      "aged-1",
      "aged-2",
      "aged-20",
      "aged-30",
      "aged-40",
    ]);
    expectNewestFirst(result);
  });

  test("tops up to the minimum with older posts", () => {
    const result = slice(postsAged(30, 100, 200, 300, 400));
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(["aged-30", "aged-100", "aged-200"]);
    expectNewestFirst(result);
  });

  test("shows the minimum when every post is old", () => {
    const result = slice(postsAged(180, 200, 250, 300, 365));
    expect(result).toHaveLength(3);
    expectNewestFirst(result);
  });

  test("shows all posts when there are fewer than the minimum", () => {
    const result = slice(postsAged(200, 200));
    expect(result).toHaveLength(2);
    expectNewestFirst(result);
  });

  test("returns an empty list when there are no posts", () => {
    expect(slice([])).toEqual([]);
  });

  test("returns newest first when given oldest first", () => {
    const result = slice(postsAged(60, 40, 20, 5, 1));
    expect(result.map((p) => p.id)).toEqual([
      "aged-1",
      "aged-5",
      "aged-20",
      "aged-40",
      "aged-60",
    ]);
  });

  test("does not reorder the caller's array", () => {
    const posts = postsAged(60, 1);
    slice(posts);
    expect(posts.map((p) => p.id)).toEqual(["aged-60", "aged-1"]);
  });

  test("a post aged exactly the guaranteed days is not guaranteed", () => {
    const result = slice(postsAged(1, 2, 3, 4, 5, 14));
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.id)).not.toContain("aged-14");
  });

  test("a post just inside the guaranteed days is guaranteed", () => {
    const result = slice(postsAged(1, 2, 3, 4, 5, 13.9));
    expect(result).toHaveLength(6);
    expect(result.map((p) => p.id)).toContain("aged-13.9");
    expectNewestFirst(result);
  });
});
